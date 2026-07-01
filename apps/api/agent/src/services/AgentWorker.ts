import { Agent } from 'agents'
import { eq } from 'drizzle-orm'
import type { AgentWorkerEnv, Agent as AgentConfig } from '@repo/types'
import { now } from '@repo/utils'
import { callWithFallback } from '@repo/llm-service'
import { createDb, agents as agentsTable } from '../models'
import { decryptRecord } from '@repo/crypto'
import { InterviewEngine } from '../pipeline/interview-engine'
import type { SKUSchema } from '../pipeline/field-schema'

interface PendingPayment {
  txId: string; checkoutRequestId: string; amount: number
  phoneNumber: string; pollCount: number; docxData: Record<string, unknown>; templateId: string
}

export interface AgentWorkerState {
  userId: string; agentSlug: string; channel: string
  messages: { role: 'user' | 'assistant'; content: string; ts: string }[]
  collectionState: any | null
  pendingPayment: PendingPayment | null
}

const MAX_HISTORY = 20
const MAX_POLLS = 12
const DOCUMENT_PRICES: Record<string, number> = {
  cv: 200, application_letter: 150, resignation_letter: 150,
  cover_letter: 150, nda: 500, invoice: 100, default: 200,
}

export class AgentWorker extends Agent<AgentWorkerEnv, AgentWorkerState> {

  initialState: AgentWorkerState = {
    userId: '', agentSlug: '', channel: 'whatsapp',
    messages: [], collectionState: null, pendingPayment: null,
  }

  private patchState(partial: Partial<AgentWorkerState>) {
    this.setState({ ...this.state, ...partial } as AgentWorkerState)
  }

  private async loadAgent(slug: string): Promise<AgentConfig | null> {
    try {
      const db  = createDb(this.env.DB)
      const row = await db.select().from(agentsTable).where(eq(agentsTable.slug, slug)).get()
      if (!row) return null
      const encKey = this.env.DB_ENCRYPTION_KEY

      let apiKeys: Record<string, string> | undefined
      if (row.apiKeys && encKey) {
        const parsed = JSON.parse(row.apiKeys) as Record<string, string>
        apiKeys = await decryptRecord(parsed, encKey)
      } else if (row.apiKeys) {
        apiKeys = JSON.parse(row.apiKeys) as Record<string, string>
      }

      let channelConfig: Record<string, unknown> | undefined
      if (row.channelConfig && encKey) {
        const parsed = JSON.parse(row.channelConfig) as Record<string, string>
        channelConfig = await decryptRecord(parsed, encKey) as Record<string, unknown>
      } else if (row.channelConfig) {
        channelConfig = JSON.parse(row.channelConfig) as Record<string, unknown>
      }

      return {
        ...row,
        toolsEnabled: JSON.parse(row.toolsEnabled) as string[],
        channelConfig,
        apiKeys,
        isActive: Boolean(row.isActive),
      } as AgentConfig
    } catch { return null }
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    try {
      const payload = await request.json() as {
        type: string; message?: string; userId?: string
        agentSlug?: string; channel?: string; skuSchema?: SKUSchema
      }

      const slug = payload.agentSlug ?? this.state.agentSlug
      if (slug && slug !== this.state.agentSlug) {
        this.patchState({ agentSlug: slug })
      }
      if (payload.userId && !this.state.userId) {
        this.patchState({ userId: payload.userId, channel: payload.channel ?? 'whatsapp' })
      }

      const agent = slug ? await this.loadAgent(slug) : null

      let reply = ''
      if (payload.type === 'reset') {
        this.patchState({ messages: [], collectionState: null, pendingPayment: null })
        reply = '✅ Conversation reset. How can I help you?'
      } else if (payload.type === 'start_interview' && payload.skuSchema) {
        const state = InterviewEngine.start(payload.skuSchema, payload.userId ?? '', slug ?? '', this.ctx.id.toString())
        this.patchState({ collectionState: state })
        reply = InterviewEngine.openingMessage(state)
        this.addMsg('assistant', reply)
      } else if (payload.type === 'check_payment') {
        reply = await this.checkPaymentStatus()
      } else if (payload.type === 'chat' && payload.message) {
        reply = await this.processChat(payload.message, agent)
      }

      return Response.json({ reply })
    } catch {
      return Response.json({ reply: 'Sorry, something went wrong. Please try again.' }, { status: 500 })
    }
  }

  async onMessage(conn: unknown, raw: string) {
    try {
      const p = JSON.parse(raw) as { type: string; message?: string; userId?: string; agentSlug?: string; channel?: string; skuSchema?: SKUSchema }
      const slug = p.agentSlug ?? this.state.agentSlug
      if (slug && slug !== this.state.agentSlug) this.patchState({ agentSlug: slug })
      if (p.userId && !this.state.userId) this.patchState({ userId: p.userId, channel: p.channel ?? 'whatsapp' })
      const agent = slug ? await this.loadAgent(slug) : null
      if (p.type === 'reset') { this.patchState({ messages: [], collectionState: null, pendingPayment: null }); this.ws(conn, '✅ Reset.'); return }
      if (p.type === 'chat' && p.message) { const r = await this.processChat(p.message, agent); this.ws(conn, r) }
    } catch { this.ws(conn, 'Sorry, something went wrong.') }
  }

  private async processChat(message: string, agent: AgentConfig | null): Promise<string> {
    this.addMsg('user', message)

    if (this.state.pendingPayment) {
      const status = await this.checkPaymentStatus()
      if (status) return status
      if (/cancel|hapana|no|quit/i.test(message)) {
        this.patchState({ pendingPayment: null })
        return '❌ Payment cancelled. Type anything to start a new document.'
      }
      return `⏳ Still waiting for your M-Pesa payment confirmation...\n\nCheck your phone and enter your PIN if prompted.\n\nType *cancel* to stop.`
    }

    if (this.state.collectionState && this.state.collectionState.status !== 'done') {
      const result = InterviewEngine.advance(this.state.collectionState, message)
      this.patchState({ collectionState: result.state })

      if (result.readyToRender) {
        const payReply = await this.initiatePayment(result.docxData ?? {}, agent)
        this.patchState({ collectionState: null })
        return payReply
      }

      this.addMsg('assistant', result.reply)
      return result.reply
    }

    return await this.chat(message, agent)
  }

  private async initiatePayment(docxData: Record<string, unknown>, agent: AgentConfig | null): Promise<string> {
    const templateId = this.state.collectionState?.templateId
      ?? (docxData['_templateId'] as string | undefined)
      ?? 'cv'
    const docType = templateId.split('_')[0] ?? 'default'
    const amount  = DOCUMENT_PRICES[docType] ?? DOCUMENT_PRICES['default']
    const phone   = this.state.userId
    const slug    = agent?.slug ?? this.state.agentSlug

    try {
      const res = await this.env.PAYMENTS_WORKER.fetch(
        new Request('http://internal/api/v1/payments/mpesa/stk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'agent' },
          body: JSON.stringify({
            userId: this.state.userId, agentSlug: slug, amount,
            phoneNumber: normalisePhone(phone),
            description: `${slug}: ${docType.replace(/_/g, ' ')}`,
            accountReference: `DOC-${Date.now()}`,
          }),
        })
      )

      const data = await res.json() as { success: boolean; data?: { transactionId: string; checkoutRequestId: string; message: string } }
      if (!data.success || !data.data) return '⚠️ Payment initiation failed. Please try again or contact support.'

      this.patchState({
        pendingPayment: {
          txId: data.data.transactionId, checkoutRequestId: data.data.checkoutRequestId,
          amount, phoneNumber: normalisePhone(phone), pollCount: 0, docxData, templateId,
        },
      })

      return `📄 Your document is ready to generate!\n\n💳 *Payment required: KES ${amount}*\n\n${data.data.message}\n\nOnce you pay, I will automatically generate and send your document. 🎉`
    } catch {
      return '⚠️ Could not initiate payment. Please try again.'
    }
  }

  private async checkPaymentStatus(): Promise<string> {
    const p = this.state.pendingPayment
    if (!p) return ''

    if (p.pollCount >= MAX_POLLS) {
      this.patchState({ pendingPayment: null })
      return '⏰ Payment timed out. Your document data is saved — send *retry* to try again.'
    }

    try {
      const res = await this.env.PAYMENTS_WORKER.fetch(
        new Request(`http://internal/api/v1/payments/mpesa/stk/${encodeURIComponent(p.checkoutRequestId)}`, {
          headers: { 'X-Internal': 'agent' },
        })
      )
      const data = await res.json() as { success: boolean; data?: { ResultCode: string } }

      if (!data.success) {
        this.patchState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
        return ''
      }

      const code = data.data?.ResultCode
      if (code === '0') {
        this.patchState({ pendingPayment: null })
        const renderReply = await this.triggerRender(p.docxData, p.templateId)
        this.addMsg('assistant', renderReply)
        return renderReply
      }

      if (code === '1032') { this.patchState({ pendingPayment: null }); return '❌ Payment was cancelled on your phone.' }
      if (code === '1037') { this.patchState({ pendingPayment: null }); return '⏰ Payment timed out on M-Pesa.' }

      this.patchState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
      return ''
    } catch {
      this.patchState({ pendingPayment: { ...p, pollCount: p.pollCount + 1 } })
      return ''
    }
  }

  private async triggerRender(fieldValues: Record<string, unknown>, templateId: string): Promise<string> {
    try {
      const res = await this.env.DOCGEN_WORKER.fetch(
        new Request('http://internal/api/v1/docgen/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'agent' },
          body: JSON.stringify({
            userId: this.state.userId, agentSlug: this.state.agentSlug,
            skuId: templateId, fieldValues,
          }),
        })
      )
      const data = await res.json() as { success: boolean; data?: { fileUrl: string; title: string } }
      if (data.success && data.data?.fileUrl) {
        return `✅ *${data.data.title}* is ready!\n\n📄 Download here:\n${data.data.fileUrl}\n\nThank you! 🎉`
      }
      return '⚠️ Document generation failed. Please contact support.'
    } catch {
      return '⚠️ Document generation failed. Please try again.'
    }
  }

  private async chat(message: string, agent: AgentConfig | null): Promise<string> {
    const prompt = agent?.systemPrompt ?? 'You are a helpful assistant.'
    const model  = agent?.modelId
    const hist   = this.state.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }))

    try {
      const response = await callWithFallback({
        model: model ?? 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: prompt },
          ...hist,
          { role: 'user', content: message },
        ],
        maxTokens: 768,
        temperature: 0.7,
      }, this.env)

      this.addMsg('assistant', response.content)
      return response.content
    } catch {
      return 'Sorry, I am unable to respond right now.'
    }
  }

  private addMsg(role: 'user' | 'assistant', content: string) {
    const msgs = [...this.state.messages, { role, content, ts: now() }]
    this.patchState({ messages: msgs.slice(-50) })
  }

  private ws(conn: unknown, msg: string) {
    try {
      if (conn && typeof (conn as any).send === 'function')
        (conn as any).send(JSON.stringify({ type: 'reply', message: msg }))
    } catch {}
  }
}

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0'))   return '254' + digits.slice(1)
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits
  return digits
}
