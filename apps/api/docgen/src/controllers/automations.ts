import type { Context } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { createDb, automationPipelines, automationRuns } from '../models'
import { runAutomation, type AutomationStep } from '../pipeline/executor'

export async function listAutomations(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(automationPipelines).orderBy(desc(automationPipelines.createdAt))
  return c.json(ok(rows.map(r => ({ ...r, steps: JSON.parse(r.steps) }))))
}

export async function getAutomation(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  const [row] = await db.select().from(automationPipelines).where(eq(automationPipelines.id, id))
  if (!row) return c.json(err('Automation not found'), 404)
  return c.json(ok({ ...row, steps: JSON.parse(row.steps) }))
}

export async function createAutomation(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const body = await c.req.json<{ name: string; agentSlug?: string; steps: AutomationStep[] }>()
  if (!body.name || !Array.isArray(body.steps)) return c.json(err('name and steps[] are required'), 400)

  const id = generateId()
  const ts = now()
  await db.insert(automationPipelines).values({
    id, name: body.name, agentSlug: body.agentSlug ?? 'default',
    steps: JSON.stringify(body.steps), isActive: 1, createdAt: ts, updatedAt: ts,
  })
  return c.json(ok({ id, name: body.name, steps: body.steps }))
}

export async function updateAutomation(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  const body = await c.req.json<{ name?: string; steps?: AutomationStep[]; isActive?: boolean }>()

  const patch: Record<string, unknown> = { updatedAt: now() }
  if (body.name !== undefined) patch.name = body.name
  if (body.steps !== undefined) patch.steps = JSON.stringify(body.steps)
  if (body.isActive !== undefined) patch.isActive = body.isActive ? 1 : 0

  await db.update(automationPipelines).set(patch).where(eq(automationPipelines.id, id))
  return c.json(ok({ id, updated: true }))
}

export async function deleteAutomation(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  await db.delete(automationPipelines).where(eq(automationPipelines.id, id))
  return c.json(ok({ id, deleted: true }))
}

export async function runAutomationById(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger('docgen', c.env)
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  const [row] = await db.select().from(automationPipelines).where(eq(automationPipelines.id, id))
  if (!row) return c.json(err('Automation not found'), 404)

  const input = await c.req.json().catch(() => ({}))
  const steps: AutomationStep[] = JSON.parse(row.steps)

  const result = await runAutomation(steps, input, c.env)

  const runId = generateId()
  await db.insert(automationRuns).values({
    id: runId, pipelineId: id, status: result.ok ? 'success' : 'error',
    input: JSON.stringify(input), output: JSON.stringify(result.output),
    logs: JSON.stringify(result.logs), createdAt: now(),
  })

  log.info({ pipelineId: id, runId, ok: result.ok, steps: steps.length }, 'automation:run')
  return c.json(result.ok ? ok({ runId, ...result }) : err(`Automation failed: ${result.logs.at(-1)?.error}`), result.ok ? 200 : 422)
}

export async function listAutomationRuns(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const pipelineId = c.req.param('id')!
  const rows = await db.select().from(automationRuns).where(eq(automationRuns.pipelineId, pipelineId)).orderBy(desc(automationRuns.createdAt)).limit(20)
  return c.json(ok(rows.map(r => ({ ...r, input: r.input ? JSON.parse(r.input) : null, output: r.output ? JSON.parse(r.output) : null, logs: r.logs ? JSON.parse(r.logs) : [] }))))
}
