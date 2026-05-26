import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter'
import { eq, desc } from 'drizzle-orm'
import { createDb, agents, conversations, messages } from './db'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from './lib/logger'
import { callGroq, type GroqMessage } from './lib/groq'

const app = new Hono<{ Bindings: AgentWorkerEnv }>()

// ─── Rate limiting ────────────────────────────────────────────────────────────

app.use('*', rateLimiter({
  windowMs:        60_000,
  limit:           120,
  standardHeaders: 'draft-6',
  keyGenerator:    (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-agent', timestamp: now() })))

// ─── List agents ──────────────────────────────────────────────────────────────

app.get('/api/v1/agent/agents', async (c) => {
  const db   = createDb(c.env.DB)
  const rows = await db.select().from(agents).orderBy(desc(agents.createdAt))
  return c.json(ok(rows))
})

app.get('/api/v1/agent/agents/:slug', async (c) => {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(agents).where(eq(agents.slug, c.req.param('slug'))).get()
  if (!row) return c.json(err('Agent not found'), 404)
  return c.json(ok(row))
})

app.post('/api/v1/agent/agents', async (c) => {
  const log  = createLogger(c.env)
  const db   = createDb(c.env.DB)
  const body = await c.req.json() as {
    name: string; slug: string; systemPrompt: string
    modelProvider?: string; modelId?: string; channel?: string; description?: string
  }

  if (!body.name || !body.slug || !body.systemPrompt)
    return c.json(err('name, slug, systemPrompt required'), 400)

  const id = generateId()
  const ts = now()

  await db.insert(agents).values({
    id, name: body.name, slug: body.slug,
    description: body.description,
    systemPrompt: body.systemPrompt,
    modelProvider: body.modelProvider ?? 'groq',
    modelId: body.modelId ?? 'llama-3.3-70b-versatile',
    channel: body.channel ?? 'whatsapp',
    createdAt: ts, updatedAt: ts,
  })

  log.info({ slug: body.slug }, 'agent created')
  return c.json(ok({ id, ...body, createdAt: ts }), 201)
})

app.put('/api/v1/agent/agents/:slug', async (c) => {
  const log  = createLogger(c.env)
  const db   = createDb(c.env.DB)
  const slug = c.req.param('slug')

  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)

  const body = await c.req.json() as Partial<typeof agents.$inferInsert>
  const ts   = now()

  await db.update(agents).set({ ...body, updatedAt: ts }).where(eq(agents.slug, slug))
  const updated = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  log.info({ slug }, 'agent updated')
  return c.json(ok(updated))
})

// ─── Chat — single turn ───────────────────────────────────────────────────────
// POST /api/v1/agent/chat
// Body: { agentSlug, userId, message, conversationId? }

app.post('/api/v1/agent/chat', async (c) => {
  const log  = createLogger(c.env)
  const db   = createDb(c.env.DB)

  const body = await c.req.json() as {
    agentSlug:       string
    userId:          string
    message:         string
    conversationId?: string
  }

  if (!body.agentSlug || !body.userId || !body.message)
    return c.json(err('agentSlug, userId, message required'), 400)

  // 1. Resolve agent
  const cacheKey = `agent:slug:${body.agentSlug}`
  const cached   = await c.env.AGENT_KV.get(cacheKey)
  const agent    = cached
    ? JSON.parse(cached) as typeof agents.$inferSelect
    : await db.select().from(agents).where(eq(agents.slug, body.agentSlug)).get()

  if (!agent) return c.json(err('Agent not found'), 404)

  if (!cached) {
    await c.env.AGENT_KV.put(cacheKey, JSON.stringify(agent), { expirationTtl: 300 })
  }

  // 2. Get or create conversation
  let convId = body.conversationId
  if (!convId) {
    convId = generateId()
    await db.insert(conversations).values({
      id: convId, userId: body.userId, agentSlug: body.agentSlug,
      channel: 'dashboard', createdAt: now(), updatedAt: now(),
    })
  }

  // 3. Fetch last 20 messages as history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(desc(messages.createdAt))
    .limit(20)

  const groqHistory: GroqMessage[] = history
    .reverse()
    .map(m => ({ role: m.role as GroqMessage['role'], content: m.content }))

  // 4. Save user message
  await db.insert(messages).values({
    id: generateId(), conversationId: convId,
    role: 'user', content: body.message, createdAt: now(),
  })

  // 5. Call Groq
  const apiKeys = agent.apiKeys ? JSON.parse(agent.apiKeys) as { groq_api_key?: string } : {}
  const groqKey = apiKeys.groq_api_key ?? c.env.GROQ_API_KEY

  const response = await callGroq(groqKey, agent.systemPrompt, groqHistory, body.message, agent.modelId)
  const reply    = response.choices[0]?.message.content ?? ''

  // 6. Save assistant message
  await db.insert(messages).values({
    id: generateId(), conversationId: convId,
    role: 'assistant', content: reply,
    tokensUsed: response.usage.total_tokens,
    createdAt: now(),
  })

  log.info({ agentSlug: body.agentSlug, tokens: response.usage.total_tokens }, 'chat turn')

  return c.json(ok({ reply, conversationId: convId, tokensUsed: response.usage.total_tokens }))
})

// ─── Conversations ────────────────────────────────────────────────────────────

app.get('/api/v1/agent/conversations/:userId', async (c) => {
  const db   = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, c.req.param('userId')))
    .orderBy(desc(conversations.updatedAt))
  return c.json(ok(rows))
})

app.get('/api/v1/agent/conversations/:id/messages', async (c) => {
  const db   = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, c.req.param('id')))
    .orderBy(messages.createdAt)
  return c.json(ok(rows))
})

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((error, c) => {
  const log = createLogger(c.env)
  log.error({ err: error }, 'unhandled agent error')
  return c.json(err('Internal server error'), 500)
})

export default app
