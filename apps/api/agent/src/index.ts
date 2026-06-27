import { Hono }              from 'hono'
import { routeAgentRequest } from 'agents'
import { honoAgents }        from 'hono-agents'
import { rateLimiter }       from 'hono-rate-limiter'
import { eq, desc }          from 'drizzle-orm'
import { createDb, agents, conversations, messages } from './db'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger }      from './lib/logger'
import { TajiAgent }         from './agents/TajiAgent'
import { ElimAgent }         from './agents/ElimAgent'

export { TajiAgent, ElimAgent }

const app = new Hono<{ Bindings: AgentWorkerEnv }>()

app.use('*', rateLimiter({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-6', keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown' }))

// Agents SDK routing — WebSockets + HTTP to Durable Objects at /agents/*
app.use('/agents/*', honoAgents({ agents: { taji: TajiAgent, elim: ElimAgent } }))

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-agent', timestamp: now() })))

// ── Agent CRUD ────────────────────────────────────────────────────────────────
app.get('/api/v1/agent/agents', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(agents).orderBy(desc(agents.createdAt))))
})
app.get('/api/v1/agent/agents/:slug', async (c) => {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(agents).where(eq(agents.slug, c.req.param('slug'))).get()
  if (!row) return c.json(err('Agent not found'), 404)
  return c.json(ok(row))
})
app.post('/api/v1/agent/agents', async (c) => {
  const db = createDb(c.env.DB); const log = createLogger(c.env)
  const body = await c.req.json() as { name: string; slug: string; systemPrompt: string; modelProvider?: string; modelId?: string; channel?: string; description?: string }
  if (!body.name || !body.slug || !body.systemPrompt) return c.json(err('name, slug, systemPrompt required'), 400)
  const id = generateId(); const ts = now()
  await db.insert(agents).values({ id, name: body.name, slug: body.slug, description: body.description, systemPrompt: body.systemPrompt, modelProvider: body.modelProvider ?? 'groq', modelId: body.modelId ?? 'llama-3.3-70b-versatile', channel: body.channel ?? 'whatsapp', createdAt: ts, updatedAt: ts })
  log.info({ slug: body.slug }, 'agent:created')
  return c.json(ok({ id, ...body, createdAt: ts }), 201)
})
app.put('/api/v1/agent/agents/:slug', async (c) => {
  const db = createDb(c.env.DB); const log = createLogger(c.env); const slug = c.req.param('slug')
  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)
  const body = await c.req.json() as Partial<typeof agents.$inferInsert>; const ts = now()
  await db.update(agents).set({ ...body, updatedAt: ts }).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:updated')
  return c.json(ok(await db.select().from(agents).where(eq(agents.slug, slug)).get()))
})
app.delete('/api/v1/agent/agents/:slug', async (c) => {
  const db = createDb(c.env.DB); const log = createLogger(c.env); const slug = c.req.param('slug')
  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)
  await db.update(agents).set({ isActive: false, updatedAt: now() }).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:deactivated')
  return c.json(ok({ message: 'Agent deactivated' }))
})

// ── HTTP Chat — for AAF workers ───────────────────────────────────────────────
// POST /api/v1/agent/chat  { agentSlug, userId, message?, channel?, type? }
// type: 'chat' (default) | 'reset' | 'start_interview'
app.post('/api/v1/agent/chat', async (c) => {
  const log  = createLogger(c.env)
  const body = await c.req.json() as { agentSlug: string; userId: string; message?: string; channel?: string; type?: string }
  if (!body.agentSlug || !body.userId) return c.json(err('agentSlug, userId required'), 400)
  const type = body.type ?? 'chat'
  if (type === 'chat' && !body.message) return c.json(err('message required for chat'), 400)
  // check_payment and reset do not require a message
  try {
    const agentBinding = body.agentSlug === 'elim' ? c.env.ElimAgent : c.env.TajiAgent
    const stub = agentBinding.get(agentBinding.idFromName(body.userId))
    const res  = await stub.fetch(new Request('http://agent/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message: body.message, userId: body.userId, agentSlug: body.agentSlug, channel: body.channel ?? 'whatsapp' }),
    }))
    const data = await res.json() as { reply?: string }
    log.info({ agentSlug: body.agentSlug, userId: body.userId, type }, 'chat:http')
    return c.json(ok({ reply: data.reply ?? '', agentSlug: body.agentSlug }))
  } catch (e) { log.error({ err: e }, 'chat:error'); return c.json(err('Chat failed'), 500) }
})

// ── Conversations (dashboard read) ────────────────────────────────────────────
app.get('/api/v1/agent/conversations/:userId', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(conversations).where(eq(conversations.userId, c.req.param('userId'))).orderBy(desc(conversations.updatedAt))))
})
app.get('/api/v1/agent/conversations/:id/messages', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(messages).where(eq(messages.conversationId, c.req.param('id'))).orderBy(messages.createdAt)))
})

app.onError((e, c) => { createLogger(c.env).error({ err: e }, 'unhandled'); return c.json(err('Internal server error'), 500) })

// ── Main export — SDK routing first, then Hono ────────────────────────────────
export default {
  async fetch(request: Request, env: AgentWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const agentRes = await routeAgentRequest(request, env)
    if (agentRes) return agentRes
    return app.fetch(request, env, ctx)
  },
}
