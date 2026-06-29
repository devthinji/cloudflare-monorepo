import type { Context } from 'hono'
import { eq, desc }      from 'drizzle-orm'
import { createDb, agents } from '../models'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '../lib/logger'

export async function listAgents(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(agents).orderBy(desc(agents.createdAt))))
}

export async function getAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(agents).where(eq(agents.slug, c.req.param('slug')!)).get()
  if (!row) return c.json(err('Agent not found'), 404)
  return c.json(ok(row))
}

export async function createAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB); const log = createLogger(c.env)
  const body = await c.req.json() as { name: string; slug: string; systemPrompt: string; modelProvider?: string; modelId?: string; channel?: string; description?: string }
  if (!body.name || !body.slug || !body.systemPrompt) return c.json(err('name, slug, systemPrompt required'), 400)
  const id = generateId(); const ts = now()
  await db.insert(agents).values({ id, name: body.name, slug: body.slug, description: body.description, systemPrompt: body.systemPrompt, modelProvider: body.modelProvider ?? 'openrouter', modelId: body.modelId ?? 'openai/gpt-4o-mini', channel: body.channel ?? 'whatsapp', createdAt: ts, updatedAt: ts })
  log.info({ slug: body.slug }, 'agent:created')
  return c.json(ok({ id, ...body, createdAt: ts }), 201)
}

export async function updateAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB); const log = createLogger(c.env); const slug = c.req.param('slug')!
  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)
  const body = await c.req.json() as Partial<typeof agents.$inferInsert>; const ts = now()
  await db.update(agents).set({ ...body, updatedAt: ts }).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:updated')
  return c.json(ok(await db.select().from(agents).where(eq(agents.slug, slug)).get()))
}

export async function deleteAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB); const log = createLogger(c.env); const slug = c.req.param('slug')!
  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)
  await db.update(agents).set({ isActive: false, updatedAt: now() }).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:deactivated')
  return c.json(ok({ message: 'Agent deactivated' }))
}
