import { Agent } from 'agents'
import type { AgentWorkerEnv } from '@repo/types'
import { now } from '@repo/utils'
import { callWithFallback } from '@repo/llm-service'

export interface ElimState {
  userId: string; channel: string
  messages: { role: 'user' | 'assistant'; content: string; ts: string }[]
  agentConfig: { systemPrompt: string; modelId: string; openrouterApiKey?: string } | null
}

export class ElimAgent extends Agent<AgentWorkerEnv, ElimState> {
  initialState: ElimState = { userId: '', channel: 'whatsapp', messages: [], agentConfig: null }

  private setPartialState(partial: Partial<ElimState>) {
    this.setPartialState({ ...this.state, ...partial })
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    try {
      const payload = await request.json() as { type: string; message?: string; userId?: string; channel?: string }
      if (payload.userId && !this.state.userId) this.setPartialState({ userId: payload.userId, channel: payload.channel ?? 'whatsapp' })
      if (payload.type === 'reset') { this.setPartialState({ messages: [], agentConfig: null }); return Response.json({ reply: '✅ Reset.' }) }
      if (payload.type === 'chat' && payload.message) { const r = await this.processChat(payload.message); return Response.json({ reply: r }) }
      return Response.json({ reply: '' })
    } catch { return Response.json({ reply: 'Sorry, something went wrong.' }, { status: 500 }) }
  }

  async onMessage(conn: unknown, raw: string) {
    try {
      const p = JSON.parse(raw) as { type: string; message?: string; userId?: string }
      if (p.userId && !this.state.userId) this.setPartialState({ userId: p.userId })
      if (p.type === 'chat' && p.message) { const r = await this.processChat(p.message); this.ws(conn, r) }
    } catch { this.ws(conn, 'Sorry, something went wrong.') }
  }

  private async processChat(message: string): Promise<string> {
    const msgs = [...this.state.messages, { role: 'user' as const, content: message, ts: now() }]
    this.setPartialState({ messages: msgs.slice(-50) })
    const hist = this.state.messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
    const prompt = this.state.agentConfig?.systemPrompt ?? ELIM_PROMPT
    const model  = this.state.agentConfig?.modelId

    try {
      const response = await callWithFallback({
        model: model ?? 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          ...hist,
          { role: 'user', content: message },
        ],
        maxTokens: 768,
        temperature: 0.5,
      }, this.env)

      const u = [...this.state.messages, { role: 'assistant' as const, content: response.content, ts: now() }]
      this.setPartialState({ messages: u.slice(-50) })
      return response.content
    } catch {
      return 'Sorry, I am unable to respond right now.'
    }
  }

  private ws(conn: unknown, msg: string) {
    try { if (conn && typeof (conn as any).send === 'function') (conn as any).send(JSON.stringify({ type: 'reply', message: msg })) } catch {}
  }
}

export const ELIM_PROMPT = `You are Elim, a CBC education assistant for Kenyan learners. You help students, teachers, and parents with the Kenyan CBC curriculum.
Keep WhatsApp messages short — max 4 sentences unless explaining a concept. Support English and Swahili.`
