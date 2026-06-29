// ─── TajiAgent — Cloudflare Agents SDK ───────────────────────────────────────
//
// One Durable Object per user (keyed by phone number / userId).
// Flow: conversation → interview → payment gate → docgen render

import { Agent } from 'agents'
import type { AgentWorkerEnv } from '@repo/types'
import { now } from '@repo/utils'
import { InterviewEngine } from '../pipeline/interview-engine'
import type { CollectionState, SKUSchema } from '../pipeline/field-schema'

// ─── State ────────────────────────────────────────────────────────────────────

export interface TajiState {
  userId:          string
  agentSlug:       string
  channel:         string
  messages:        { role: 'user' | 'assistant'; content: string; ts: string }[]
  collectionState: CollectionState | null
  // Payment gate
  pendingPayment: {
    txId:              string
    checkoutRequestId: string
    amount:            number
    phoneNumber:       string
    pollCount:         number
    docxData:          Record<string, unknown>
    templateId:        string
  } | null
  agentConfig: { systemPrompt: string; modelId: string; groqApiKey?: string } | null
}

const GROQ_API    = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_HISTORY = 20
const MAX_POLLS   = 12   // 12 × 5s = 60s max wait

// ─── Document prices (KES) ────────────────────────────────────────────────────
// These will eventually be driven by SKU schema — hardcoded for now

const DOCUMENT_PRICES: Record<string, number> = {
  cv:                  200,
  application_letter:  150,
  resignation_letter:  150,
  cover_letter:        150,
  nda:                 500,
  invoice:             100,
  default:             200,
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class TajiAgent extends Agent<AgentWorkerEnv, TajiState> {

  initialState: TajiState = {
    userId: '', agentSlug: 'taji', channel: 'whatsapp',
    messages: [], collectionState: null, pendingPayment: null, agentConfig: null,
  }

  // ── Partial state update helper ──────────────────────────────────────────

  private setPartialState(partial: Partial<TajiState>) {
    this.setPartialState({ ...this.state, ...partial })
  }

  // ── HTTP handler — service binding calls ──────────────────────────────────

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    try {
      const payload = await request.json() as {
        type:       string
        message?:   string
        userId?:    string
        agentSlug?: string
        channel?:   string
        skuSchema?: SKUSchema
      }

      if (payload.userId && !this.state.userId) {
        this.setPartialState({ userId: payload.userId, agentSlug: payload.agentSlug ?? 'taji', channel: payload.channel ?? 'whatsapp' })
      }

      let reply = ''

      if (payload.type === 'reset') {
        this.setPartialState({ messages: [], collectionState: null, pendingPayment: null })
        reply = '✅ Conversation reset. How can I help you?'

      } else if (payload.type === 'start_interview' && payload.skuSchema) {
        const state = InterviewEngine.start(payload.skuSchema, payload.userId ?? '', payload.agentSlug ?? 'taji', this.ctx.id.toString())
        this.setPartialState({ collectionState: state })
        reply = InterviewEngine.openingMessage(state)
        this.addMsg('assistant', reply)

      } else if (payload.type === 'check_payment') {
        // Called by a scheduled poll — check if payment is confirmed
        reply = await this.checkPaymentStatus()

      } else if (payload.type === 'chat' && payload.message) {
        reply = await this.processChat(payload.message)
      }

      return Response.json({ reply })
    } catch {
      return Response.json({ reply: 'Sorry, something went wrong. Please try again.' }, { status: 500 })
    }
  }

  // ── WebSocket messages ────────────────────────────────────────────────────

  async onMessage(conn: unknown, raw: string) {
    try {
      const p = JSON.parse(raw) as { type: string; message?: string; userId?: string; agentSlug?: string; channel?: string; skuSchema?: SKUSchema }
      if (p.userId && !this.state.userId) this.setPartialState({ userId: p.userId, agentSlug: p.agentSlug ?? 'taji', channel: p.channel ?? 'whatsapp' })
      if (p.type === 'reset') { this.setPartialState({ messages: [], collectionState: null, pendingPayment: null }); this.ws(conn, '✅ Reset.'); return }
      if (p.type === 'chat' && p.message) { const r = await this.processChat(p.message); this.ws(conn, r) }
    } catch { this.ws(conn, 'Sorry, something went wrong.') }
  }

  // ── Main chat processor ───────────────────────────────────────────────────

  private async processChat(message: string): Promise<string> {
    this.addMsg('user', message)

    // ── If waiting for payment confirmation ──────────────────────────────────
    if (this.state.pendingPayment) {
      const status = await this.checkPaymentStatus()
      if (status) return status
      // Payment still pending — check if user wants to cancel
      if (/cancel|hapana|no|quit/i.test(message)) {
        this.setPartialState({ pendingPayment: null })
        return '❌ Payment cancelled. Type anything to start a new document.'
      }
      return `⏳ Still waiting for your M-Pesa payment confirmation...\n\nCheck your phone and enter your PIN if prompted.\n\nType *cancel* to stop.`
    }

    // ── Interview mode ───────────────────────────────────────────────────────
    if (this.state.collectionState && this.state.collectionState.status !== 'done') {
      const result = InterviewEngine.advance(this.state.collectionState, message)
      this.setPartialState({ collectionState: result.state })

      if (result.readyToRender) {
        // Interview complete — initiate payment before rendering
        const payReply = await this.initiatePayment(result.docxData ?? {})
        this.setPartialState({ collectionState: null })
        return payReply
      }

      this.addMsg('assistant', result.reply)
      return result.reply
    }

    // ── Normal conversation ──────────────────────────────────────────────────
    return await this.chat(message)
  }

  // ── Payment initiation ────────────────────────────────────────────────────

  private async initiatePayment(docxData: Record<string, unknown>): Promise<string> {
    const templateId = this.state.collectionState?.templateId
      ?? (docxData['_templateId'] as string | undefined)
      ?? 'cv'

    const docType  = templateId.split('_')[0] ?? 'default'
    const amount   = DOCUMENT_PRICES[docType] ?? DOCUMENT_PRICES['default']
    const phone    = this.state.userId   // userId is phone number for WhatsApp

    try {
      const res = await this.env.PAYMENTS_WORKER.fetch(
        new Request('http://internal/api/v1/payments/mpesa/stk', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'agent' },
          body: JSON.stringify({
            userId:           this.state.userId,
            agentSlug:        this.state.agentSlug,
            amount,
            phoneNumber:      normalisePhone(phone),
            description:      `Taji: ${docType.replace(/_/g, ' ')}`,
            accountReference: `TAJI-${Date.now()}`,
          }),
        })
      )

      const data = await res.json() as { success: boolean; data?: { transactionId: string; checkoutRequestId: string; message: string } }

      if (!data.success || !data.data) {
        return '⚠️ Payment initiation failed. Please try again or contact support.'
      }

      // Save pending payment state
      this.setPartialState({
        pendingPayment: {
          txId:              data.data.transactionId,
          checkoutRequestId: data.data.checkoutRequestId,
          amount,
          phoneNumber:       normalisePhone(phone),
          pollCount:         0,
          docxData,
          templateId,
        },
      })

      return `📄 Your document is ready to generate!\n\n💳 *Payment required: KES ${amount}*\n\n${data.data.message}\n\nOnce you pay, I will automatically generate and send your document. 🎉`

    } catch {
      return '⚠️ Could not initiate payment. Please try again.'
    }
  }

  // ── Poll payment status ───────────────────────────────────────────────────

  private async checkPaymentStatus(): Promise<string> {
    const p = this.state.pendingPayment
    if (!p) return ''

    if (p.pollCount >= MAX_POLLS) {
      this.setPartialState({ pendingPayment: null })
      return '⏰ Payment timed out. Your document data is saved — send *retry* to try again.'
    }

    try {
      const res = await this.env.PAYMENTS_WORKER.fetch(
        new Request(`http://internal/api/v1/payments/mpesa/stk/${encodeURIComponent(p.checkoutRequestId)}`, {
          headers: { 'X-Internal': 'agent' },
        })
      )
      const data = await res.json() as { success: boolean; data?: { ResultCode: string; ResultDesc: string } }

      if (!data.success) {
        this.setPartialState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
        return ''   // still pending — no message to send
      }

      const code = data.data?.ResultCode
      if (code === '0') {
        // ✅ Payment confirmed — render document
        this.setPartialState({ pendingPayment: null })
        const renderReply = await this.triggerRender(p.docxData, p.templateId)
        this.addMsg('assistant', renderReply)
        return renderReply
      }

      if (code === '1032') {
        // User cancelled on phone
        this.setPartialState({ pendingPayment: null })
        return '❌ Payment was cancelled. Send *retry* if you\'d like to try again.'
      }

      if (code === '1037') {
        // Timed out on Safaricom side
        this.setPartialState({ pendingPayment: null })
        return '⏰ Payment timed out on M-Pesa. Send *retry* to try again.'
      }

      // Still pending
      this.setPartialState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
      return ''

    } catch {
      this.setPartialState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
      return ''
    }
  }

  // ── Trigger docgen render ─────────────────────────────────────────────────

  private async triggerRender(fieldValues: Record<string, unknown>, templateId: string): Promise<string> {
    try {
      const res = await this.env.DOCGEN_WORKER.fetch(
        new Request('http://internal/api/v1/docgen/render', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'agent' },
          body: JSON.stringify({
            userId:     this.state.userId,
            agentSlug:  this.state.agentSlug,
            templateId,
            fieldValues,
          }),
        })
      )
      const data = await res.json() as { success: boolean; data?: { fileUrl: string; title: string } }
      if (data.success && data.data?.fileUrl) {
        return `✅ *${data.data.title}* is ready!\n\n📄 Download here:\n${data.data.fileUrl}\n\nThank you for using Taji! 🎉`
      }
      return '⚠️ Document generation failed. Please contact support.'
    } catch {
      return '⚠️ Document generation failed. Please try again.'
    }
  }

  // ── Normal LLM chat ───────────────────────────────────────────────────────

  private async chat(message: string): Promise<string> {
    const apiKey = this.state.agentConfig?.groqApiKey ?? this.env.GROQ_API_KEY
    const prompt = this.state.agentConfig?.systemPrompt ?? TAJI_SYSTEM_PROMPT
    const model  = this.state.agentConfig?.modelId ?? 'llama-3.3-70b-versatile'
    const hist   = this.state.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch(GROQ_API, {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt }, ...hist], max_tokens: 512, temperature: 0.7 }),
      })
      if (!res.ok) return this.cfAI(prompt, hist, message)
      const d = await res.json() as { choices: { message: { content: string } }[] }
      const r = d.choices[0]?.message.content ?? 'Sorry, I could not respond.'
      this.addMsg('assistant', r); return r
    } catch { return this.cfAI(prompt, hist, message) }
  }

  private async cfAI(prompt: string, hist: { role: string; content: string }[], msg: string): Promise<string> {
    try {
      const r = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'system', content: prompt }, ...hist, { role: 'user', content: msg }],
        max_tokens: 512,
      })
      const reply = r?.response ?? 'Sorry, I am unable to respond right now.'
      this.addMsg('assistant', reply); return reply
    } catch { return 'Sorry, I am unable to respond right now.' }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private addMsg(role: 'user' | 'assistant', content: string) {
    const msgs = [...this.state.messages, { role, content, ts: now() }]
    this.setPartialState({ messages: msgs.slice(-50) })
  }

  private ws(conn: unknown, msg: string) {
    try {
      if (conn && typeof (conn as any).send === 'function')
        (conn as any).send(JSON.stringify({ type: 'reply', message: msg }))
    } catch {}
  }
}

// ── Normalise phone to 2547XXXXXXXX format ────────────────────────────────────

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0'))   return '254' + digits.slice(1)
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits
  return digits
}

export const TAJI_SYSTEM_PROMPT = `You are Taji, a professional document assistant on WhatsApp. You help people create CVs, application letters, resignation letters, NDAs, invoices, and other professional documents.

You are warm, concise, and professional. Keep responses under 3 sentences unless showing a document summary.

When a user asks for a document, tell them the available templates and let them pick one — the interview begins automatically.

Documents cost between KES 100-500. Payment is via M-Pesa and is required before generating.

You support English and Swahili.`
