import { Agent } from 'agents'
import type { AgentWorkerEnv } from '@repo/types'
import { now } from '@repo/utils'
import { InterviewEngine } from '../pipeline/interview-engine'
import type { CollectionState, SKUSchema } from '../pipeline/field-schema'

export interface TajiState {
  userId:          string
  agentSlug:       string
  channel:         string
  messages:        { role: 'user' | 'assistant'; content: string; ts: string }[]
  collectionState: CollectionState | null
  agentConfig:     { systemPrompt: string; modelId: string; groqApiKey?: string } | null
}

const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_HISTORY = 20

export class TajiAgent extends Agent<AgentWorkerEnv, TajiState> {
  initialState: TajiState = { userId: '', agentSlug: 'taji', channel: 'whatsapp', messages: [], collectionState: null, agentConfig: null }

  // ── HTTP handler — service binding calls from AAF workers ─────────────────
  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    try {
      const payload = await request.json() as { type: string; message?: string; userId?: string; agentSlug?: string; channel?: string; skuSchema?: SKUSchema }
      if (payload.userId && !this.state.userId) this.setState({ userId: payload.userId, agentSlug: payload.agentSlug ?? 'taji', channel: payload.channel ?? 'whatsapp' })
      let reply = ''
      if (payload.type === 'reset') {
        this.setState({ messages: [], collectionState: null }); reply = '✅ Conversation reset.'
      } else if (payload.type === 'start_interview' && payload.skuSchema) {
        const state = InterviewEngine.start(payload.skuSchema, payload.userId ?? '', payload.agentSlug ?? 'taji', this.id.toString())
        this.setState({ collectionState: state })
        reply = InterviewEngine.openingMessage(state)
        this.addMsg('assistant', reply)
      } else if (payload.type === 'chat' && payload.message) {
        reply = await this.processChat(payload.message)
      }
      return Response.json({ reply })
    } catch (e) {
      return Response.json({ reply: 'Sorry, something went wrong.' }, { status: 500 })
    }
  }

  // ── WebSocket messages ────────────────────────────────────────────────────
  async onMessage(connection: unknown, rawMessage: string) {
    try {
      const payload = JSON.parse(rawMessage) as { type: string; message?: string; userId?: string; agentSlug?: string; channel?: string; skuSchema?: SKUSchema }
      if (payload.userId && !this.state.userId) this.setState({ userId: payload.userId, agentSlug: payload.agentSlug ?? 'taji', channel: payload.channel ?? 'whatsapp' })
      if (payload.type === 'reset') { this.setState({ messages: [], collectionState: null }); this.ws(connection, '✅ Reset.'); return }
      if (payload.type === 'start_interview' && payload.skuSchema) {
        const state = InterviewEngine.start(payload.skuSchema, payload.userId ?? '', 'taji', this.id.toString())
        this.setState({ collectionState: state }); this.ws(connection, InterviewEngine.openingMessage(state)); return
      }
      if (payload.type === 'chat' && payload.message) { const r = await this.processChat(payload.message); this.ws(connection, r) }
    } catch { this.ws(connection, 'Sorry, something went wrong.') }
  }

  private async processChat(message: string): Promise<string> {
    this.addMsg('user', message)
    // Interview mode
    if (this.state.collectionState && this.state.collectionState.status !== 'done') {
      const result = InterviewEngine.advance(this.state.collectionState, message)
      this.setState({ collectionState: result.state })
      if (result.readyToRender) {
        const r = await this.triggerRender(result.docxData ?? {})
        this.addMsg('assistant', r); this.setState({ collectionState: null }); return r
      }
      this.addMsg('assistant', result.reply); return result.reply
    }
    // Normal chat
    const apiKey = this.state.agentConfig?.groqApiKey ?? this.env.GROQ_API_KEY
    const prompt = this.state.agentConfig?.systemPrompt ?? TAJI_SYSTEM_PROMPT
    const model  = this.state.agentConfig?.modelId      ?? 'llama-3.3-70b-versatile'
    const hist   = this.state.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch(GROQ_API, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt }, ...hist], max_tokens: 512, temperature: 0.7 }) })
      if (!res.ok) return this.cfAI(prompt, hist, message)
      const d = await res.json() as { choices: { message: { content: string } }[] }
      const r = d.choices[0]?.message.content ?? 'Sorry, I could not respond.'
      this.addMsg('assistant', r); return r
    } catch { return this.cfAI(prompt, hist, message) }
  }

  private async cfAI(prompt: string, hist: { role: string; content: string }[], msg: string): Promise<string> {
    try {
      const r = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'system', content: prompt }, ...hist, { role: 'user', content: msg }], max_tokens: 512 })
      const reply = r?.response ?? 'Sorry, I am unable to respond right now.'
      this.addMsg('assistant', reply); return reply
    } catch { return 'Sorry, I am unable to respond right now.' }
  }

  private async triggerRender(fieldValues: Record<string, unknown>): Promise<string> {
    if (!this.state.collectionState) return 'Document ready.'
    try {
      const res  = await this.env.DOCGEN_WORKER.fetch(new Request('http://internal/api/v1/docgen/render', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal': 'agent' }, body: JSON.stringify({ userId: this.state.userId, agentSlug: this.state.agentSlug, templateId: this.state.collectionState.templateId, fieldValues }) }))
      const data = await res.json() as { success: boolean; data?: { fileUrl: string; title: string } }
      return data.success && data.data?.fileUrl ? `✅ Your *${data.data.title}* is ready!\n\n📄 ${data.data.fileUrl}\n\nThank you for using Taji! 🎉` : '⚠️ Document generation failed. Please try again.'
    } catch { return '⚠️ Document generation failed. Please try again.' }
  }

  private addMsg(role: 'user' | 'assistant', content: string) {
    const msgs = [...this.state.messages, { role, content, ts: now() }]
    this.setState({ messages: msgs.slice(-50) })
  }

  private ws(conn: unknown, msg: string) {
    try { if (conn && typeof (conn as any).send === 'function') (conn as any).send(JSON.stringify({ type: 'reply', message: msg })) } catch {}
  }
}

export const TAJI_SYSTEM_PROMPT = `You are Taji, a professional document assistant on WhatsApp. You help people create CVs, application letters, resignation letters, NDAs, invoices, and other professional documents.
You are warm, concise, and professional. Keep responses under 3 sentences unless showing a summary.
When a user asks for a document, tell them which templates are available, let them pick one — the interview begins automatically.
You support English and Swahili.`
