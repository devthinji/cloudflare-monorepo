import type { Context } from 'hono'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err } from '@repo/utils'
import { createLogger } from '../lib/logger'

export async function chat(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const log  = createLogger(c.env)
  const body = await c.req.json() as { agentSlug: string; userId: string; message?: string; channel?: string; type?: string }
  if (!body.agentSlug || !body.userId) return c.json(err('agentSlug, userId required'), 400)
  const type = body.type ?? 'chat'
  if (type === 'chat' && !body.message) return c.json(err('message required for chat'), 400)

  try {
    const stub = c.env.AGENT_DO.get(c.env.AGENT_DO.idFromName(body.userId))
    const res  = await stub.fetch(new Request('http://agent/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message: body.message, userId: body.userId, agentSlug: body.agentSlug, channel: body.channel ?? 'whatsapp' }),
    }))
    const data = await res.json() as { reply?: string }
    log.info({ agentSlug: body.agentSlug, userId: body.userId, type }, 'chat:http')
    return c.json(ok({ reply: data.reply ?? '', agentSlug: body.agentSlug }))
  } catch (e) { log.error({ err: e }, 'chat:error'); return c.json(err('Chat failed'), 500) }
}
