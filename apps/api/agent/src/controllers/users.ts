import type { Context } from 'hono'
import { eq }            from 'drizzle-orm'
import { createDb, users } from '../models'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'

export async function getUser(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(users).where(eq(users.id, c.req.param('userId')!)).get()
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
}

export async function createOrUpdateUser(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db   = createDb(c.env.DB)
  const log  = createLogger('agent', c.env)
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
    id: body.userId, name: body.name,
    phone: body.phone, channel: body.channel ?? 'whatsapp',
    agentSlug: body.agentSlug ?? null, isRegistered: true, isBlocked: false,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt: ts, updatedAt: ts,
  })

  log.info({ userId: body.userId }, 'user:created')
  return c.json(ok({ id: body.userId, registered: true, created: true }), 201)
}

export async function patchUser(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db   = createDb(c.env.DB)
  const log  = createLogger('agent', c.env)
  const body = await c.req.json() as {
    name?: string; phone?: string; agentSlug?: string; isBlocked?: boolean; metadata?: Record<string, unknown>
  }

  const existing = await db.select().from(users).where(eq(users.id, c.req.param('userId')!)).get()
  if (!existing) return c.json(err('User not found'), 404)

  const updates: Partial<typeof existing> = { updatedAt: now() }
  if (body.name      !== undefined) updates.name      = body.name
  if (body.phone     !== undefined) updates.phone     = body.phone
  if (body.agentSlug !== undefined) updates.agentSlug = body.agentSlug
  if (body.isBlocked !== undefined) updates.isBlocked = body.isBlocked
  if (body.metadata  !== undefined) updates.metadata  = JSON.stringify(body.metadata)

  await db.update(users).set(updates).where(eq(users.id, c.req.param('userId')!))
  log.info({ userId: c.req.param('userId')! }, 'user:patched')
  return c.json(ok({ updated: true }))
}

export async function listUsers(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db   = createDb(c.env.DB)
  const { desc: drizzleDesc } = await import('drizzle-orm')
  const rows = await db.select().from(users).orderBy(drizzleDesc(users.createdAt)).limit(200)
  return c.json(ok(rows.map(r => ({
    ...r, registered: !!r.isRegistered, blocked: !!r.isBlocked,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }))))
}
