import { Hono }              from 'hono'
import { routeAgentRequest } from 'agents'
import { rateLimiter }       from 'hono-rate-limiter'
import { eq, desc }          from 'drizzle-orm'
import { createDb, agents, conversations, messages, users } from './db'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger }      from './lib/logger'
import { TajiAgent }         from './agents/TajiAgent'
import { ElimAgent }         from './agents/ElimAgent'

export { TajiAgent, ElimAgent }

const app = new Hono<{ Bindings: AgentWorkerEnv }>()

app.use('*', rateLimiter({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-6', keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown' }))

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


// ── Users — registration & lookup ────────────────────────────────────────────
// Used by the ConversationMachine in the gateway to identify callers.

// GET /api/v1/agent/users/:userId
app.get('/api/v1/agent/users/:userId', async (c) => {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(users).where(eq(users.id, c.req.param('userId'))).get()
  if (!row) return c.json(err('User not found'), 404)
  return c.json(ok({
    found:        true,
    id:           row.id,
    name:         row.name,
    phone:        row.phone,
    channel:      row.channel,
    agentSlug:    row.agentSlug,
    registered:   !!row.isRegistered,
    isBlocked:    !!row.isBlocked,
    metadata:     row.metadata ? JSON.parse(row.metadata) : null,
    createdAt:    row.createdAt,
    updatedAt:    row.updatedAt,
  }))
})

// POST /api/v1/agent/users
// Body: { userId, name, channel?, agentSlug?, phone?, metadata? }
// Creates or upserts — safe to call multiple times
app.post('/api/v1/agent/users', async (c) => {
  const db   = createDb(c.env.DB)
  const log  = createLogger(c.env)
  const body = await c.req.json() as {
    userId:     string
    name:       string
    channel?:   string
    agentSlug?: string
    phone?:     string
    metadata?:  Record<string, unknown>
  }

  if (!body.userId || !body.name) return c.json(err('userId and name required'), 400)

  const ts       = now()
  const existing = await db.select().from(users).where(eq(users.id, body.userId)).get()

  if (existing) {
    // Update name + registration flag; never overwrite with empty values
    await db.update(users).set({
      name:         body.name,
      isRegistered: true,
      agentSlug:    body.agentSlug ?? existing.agentSlug,
      phone:        body.phone    ?? existing.phone,
      metadata:     body.metadata ? JSON.stringify(body.metadata) : existing.metadata,
      updatedAt:    ts,
    }).where(eq(users.id, body.userId))
    log.info({ userId: body.userId }, 'user:updated')
    return c.json(ok({ id: body.userId, registered: true, created: false }))
  }

  await db.insert(users).values({
    id:           body.userId,
    name:         body.name,
    phone:        body.phone,
    channel:      body.channel   ?? 'whatsapp',
    agentSlug:    body.agentSlug ?? null,
    isRegistered: true,
    isBlocked:    false,
    metadata:     body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt:    ts,
    updatedAt:    ts,
  })

  log.info({ userId: body.userId }, 'user:created')
  return c.json(ok({ id: body.userId, registered: true, created: true }), 201)
})

// PATCH /api/v1/agent/users/:userId — update profile fields
app.patch('/api/v1/agent/users/:userId', async (c) => {
  const db   = createDb(c.env.DB)
  const log  = createLogger(c.env)
  const body = await c.req.json() as {
    name?:       string
    phone?:      string
    agentSlug?:  string
    isBlocked?:  boolean
    metadata?:   Record<string, unknown>
  }

  const existing = await db.select().from(users).where(eq(users.id, c.req.param('userId'))).get()
  if (!existing) return c.json(err('User not found'), 404)

  const updates: Partial<typeof existing> = { updatedAt: now() }
  if (body.name      !== undefined) updates.name      = body.name
  if (body.phone     !== undefined) updates.phone     = body.phone
  if (body.agentSlug !== undefined) updates.agentSlug = body.agentSlug
  if (body.isBlocked !== undefined) updates.isBlocked = body.isBlocked
  if (body.metadata  !== undefined) updates.metadata  = JSON.stringify(body.metadata)

  await db.update(users).set(updates).where(eq(users.id, c.req.param('userId')))
  log.info({ userId: c.req.param('userId') }, 'user:patched')
  return c.json(ok({ updated: true }))
})

// GET /api/v1/agent/users — admin list (dashboard)
app.get('/api/v1/agent/users', async (c) => {
  const db   = createDb(c.env.DB)
  const { desc: drizzleDesc } = await import('drizzle-orm')
  const rows = await db.select().from(users).orderBy(drizzleDesc(users.createdAt)).limit(200)
  return c.json(ok(rows.map(r => ({
    ...r,
    registered: !!r.isRegistered,
    blocked:    !!r.isBlocked,
    metadata:   r.metadata ? JSON.parse(r.metadata) : null,
  }))))
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
