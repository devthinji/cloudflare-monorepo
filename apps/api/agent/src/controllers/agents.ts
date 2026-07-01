import type { Context } from 'hono'
import { eq, desc }      from 'drizzle-orm'
import { createDb, agents } from '../models'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { encryptRecord, decryptRecord, maskRecord } from '@repo/crypto'

// ── helpers ───────────────────────────────────────────────────────────────────

async function encryptAgentSecrets(
  body: { apiKeys?: Record<string, string>; channelConfig?: Record<string, unknown> },
  encKey: string
) {
  const updates: { apiKeys?: string; channelConfig?: string } = {}
  if (body.apiKeys)      updates.apiKeys      = JSON.stringify(await encryptRecord(body.apiKeys, encKey))
  if (body.channelConfig) updates.channelConfig = JSON.stringify(await encryptRecord(body.channelConfig as Record<string, string>, encKey))
  return updates
}

async function decryptAgentSecrets(
  row: { apiKeys?: string | null; channelConfig?: string | null },
  encKey: string
) {
  let apiKeys:      Record<string, string>  | undefined
  let channelConfig: Record<string, unknown> | undefined
  if (row.apiKeys) {
    const parsed = JSON.parse(row.apiKeys) as Record<string, string>
    apiKeys = await decryptRecord(parsed, encKey)
  }
  if (row.channelConfig) {
    const parsed = JSON.parse(row.channelConfig) as Record<string, string>
    channelConfig = await decryptRecord(parsed, encKey)
  }
  return { apiKeys, channelConfig }
}

// ── controllers ───────────────────────────────────────────────────────────────

export async function listAgents(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(agents).orderBy(desc(agents.createdAt))
  // Return masked secrets — never raw values in list responses
  const result = rows.map(r => {
    const keys = r.apiKeys ? (() => { try { return maskRecord(JSON.parse(r.apiKeys!) as Record<string, string>) } catch { return {} } })() : undefined
    return { ...r, apiKeys: keys, channelConfig: r.channelConfig ? (() => { try { return JSON.parse(r.channelConfig!) } catch { return {} } })() : undefined }
  })
  return c.json(ok(result))
}

export async function getAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const row = await db.select().from(agents).where(eq(agents.slug, c.req.param('slug')!)).get()
  if (!row) return c.json(err('Agent not found'), 404)
  // Mask secrets in single-agent GET as well — use PUT to update them
  const keys = row.apiKeys ? (() => { try { return maskRecord(JSON.parse(row.apiKeys) as Record<string, string>) } catch { return {} } })() : undefined
  return c.json(ok({ ...row, apiKeys: keys }))
}

export async function createAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const log = createLogger('agent', c.env)
  const body = await c.req.json() as {
    name: string; slug: string; systemPrompt: string
    modelProvider?: string; modelId?: string; channel?: string; description?: string
    apiKeys?: Record<string, string>; channelConfig?: Record<string, unknown>
  }
  if (!body.name || !body.slug || !body.systemPrompt) return c.json(err('name, slug, systemPrompt required'), 400)

  const encKey = c.env.DB_ENCRYPTION_KEY
  if (!encKey) return c.json(err('DB_ENCRYPTION_KEY not configured'), 500)

  const id = generateId()
  const ts = now()
  const encrypted = await encryptAgentSecrets(body, encKey)

  await db.insert(agents).values({
    id, name: body.name, slug: body.slug, description: body.description,
    systemPrompt: body.systemPrompt,
    modelProvider: body.modelProvider ?? 'openrouter',
    modelId: body.modelId ?? 'openai/gpt-4o-mini',
    channel: body.channel ?? 'whatsapp',
    apiKeys: encrypted.apiKeys ?? null,
    channelConfig: encrypted.channelConfig ?? null,
    createdAt: ts, updatedAt: ts,
  })
  log.info({ slug: body.slug }, 'agent:created')
  return c.json(ok({ id, slug: body.slug, name: body.name, createdAt: ts }), 201)
}

export async function updateAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const log = createLogger('agent', c.env)
  const slug = c.req.param('slug')!

  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)

  const body = await c.req.json() as Partial<{
    name: string; systemPrompt: string; modelProvider: string; modelId: string
    channel: string; description: string; isActive: boolean
    apiKeys: Record<string, string>; channelConfig: Record<string, unknown>
  }>
  const ts = now()

  const encKey = c.env.DB_ENCRYPTION_KEY
  if (!encKey) return c.json(err('DB_ENCRYPTION_KEY not configured'), 500)

  // Build update payload — only encrypt if secrets are being updated
  const { apiKeys: _ak, channelConfig: _cc, ...safeBody } = body
  const updates: Record<string, unknown> = { ...safeBody, updatedAt: ts }

  if (body.apiKeys) {
    // Merge with existing encrypted keys (don't wipe keys not included in this update)
    const existingKeys: Record<string, string> = existing.apiKeys
      ? await decryptRecord(JSON.parse(existing.apiKeys) as Record<string, string>, encKey)
      : {}
    const merged = { ...existingKeys, ...body.apiKeys }
    updates.apiKeys = JSON.stringify(await encryptRecord(merged, encKey))
  }
  if (body.channelConfig) {
    updates.channelConfig = JSON.stringify(await encryptRecord(body.channelConfig as Record<string, string>, encKey))
  }

  await db.update(agents).set(updates).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:updated')
  return c.json(ok({ updated: true }))
}

export async function deleteAgent(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db  = createDb(c.env.DB)
  const log = createLogger('agent', c.env)
  const slug = c.req.param('slug')!
  const existing = await db.select().from(agents).where(eq(agents.slug, slug)).get()
  if (!existing) return c.json(err('Agent not found'), 404)
  await db.update(agents).set({ isActive: false, updatedAt: now() }).where(eq(agents.slug, slug))
  log.info({ slug }, 'agent:deactivated')
  return c.json(ok({ message: 'Agent deactivated' }))
}
