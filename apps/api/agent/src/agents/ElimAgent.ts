import { Agent } from 'agents'
import type { AgentWorkerEnv } from '@repo/types'
import { now } from '@repo/utils'

export interface ElimState {
  userId: string; channel: string
  messages: { role: 'user' | 'assistant'; content: string; ts: string }[]
}

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

export class ElimAgent extends Agent<AgentWorkerEnv, ElimState> {
  initialState: ElimState = { userId: '', channel: 'whatsapp', messages: [] }

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    try {
      const payload = await request.json() as { type: string; message?: string; userId?: string; channel?: string }
      if (payload.userId && !this.state.userId) this.setState({ userId: payload.userId, channel: payload.channel ?? 'whatsapp' })
      if (payload.type === 'reset') { this.setState({ messages: [] }); return Response.json({ reply: '✅ Reset.' }) }
      if (payload.type === 'chat' && payload.message) { const r = await this.processChat(payload.message); return Response.json({ reply: r }) }
      return Response.json({ reply: '' })
    } catch { return Response.json({ reply: 'Sorry, something went wrong.' }, { status: 500 }) }
  }

  async onMessage(conn: unknown, raw: string) {
    try {
      const p = JSON.parse(raw) as { type: string; message?: string; userId?: string }
      if (p.userId && !this.state.userId) this.setState({ userId: p.userId })
      if (p.type === 'chat' && p.message) { const r = await this.processChat(p.message); this.ws(conn, r) }
    } catch { this.ws(conn, 'Sorry, something went wrong.') }
  }

  private async processChat(message: string): Promise<string> {
    const msgs = [...this.state.messages, { role: 'user' as const, content: message, ts: now() }]
    this.setState({ messages: msgs.slice(-50) })
    const hist = this.state.messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch(GROQ_API, { method: 'POST', headers: { Authorization: `Bearer ${this.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: ELIM_PROMPT }, ...hist], max_tokens: 768, temperature: 0.5 }) })
      let reply: string
      if (!res.ok) { const r = await (this.env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'system', content: ELIM_PROMPT }, ...hist, { role: 'user', content: message }], max_tokens: 512 }); reply = r?.response ?? 'Sorry, I am unable to respond.' }
      else { const d = await res.json() as { choices: { message: { content: string } }[] }; reply = d.choices[0]?.message.content ?? 'Sorry.' }
      const u = [...this.state.messages, { role: 'assistant' as const, content: reply, ts: now() }]
      this.setState({ messages: u.slice(-50) }); return reply
    } catch { return 'Sorry, I am unable to respond right now.' }
  }

  private ws(conn: unknown, msg: string) {
    try { if (conn && typeof (conn as any).send === 'function') (conn as any).send(JSON.stringify({ type: 'reply', message: msg })) } catch {}
  }
}

export const ELIM_PROMPT = `You are Elim, a CBC education assistant for Kenyan learners. You help students, teachers, and parents with the Kenyan CBC curriculum.
Keep WhatsApp messages short — max 4 sentences unless explaining a concept. Support English and Swahili.`
