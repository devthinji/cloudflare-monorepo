import type { Context } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now, slugify } from '@repo/utils'
import { createLogger } from '../lib/logger'
import { templates } from '../models'
import { createDb } from '../models'
import { runExtractionPipeline } from '../pipeline/extractor'
import type { SKUSchema } from '../pipeline/field-schema'

export async function listTemplates(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(templates).orderBy(desc(templates.createdAt))))
}

export async function getTemplate(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const row = await db.select().from(templates).where(eq(templates.id, c.req.param('id')!)).get()
  if (!row) return c.json(err('Template not found'), 404)
  return c.json(ok(row))
}

export async function getTemplatesByAgent(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const slug = c.req.param('agentSlug')!
  const rows = await db.select().from(templates).where(eq(templates.isActive, true)).orderBy(templates.documentType, templates.price)
  const filtered = rows.filter(r => { try { return (JSON.parse(r.agentSlugs) as string[]).includes(slug) } catch { return false } })
  return c.json(ok(filtered))
}

export async function uploadTemplate(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  let formData: FormData
  try { formData = await c.req.formData() } catch { return c.json(err('Expected multipart/form-data'), 400) }

  const file = formData.get('file') as File | null
  const name = formData.get('name') as string | null
  const documentType = formData.get('documentType') as string | null
  const tier = formData.get('tier') as string | null
  const agentSlugsRaw = formData.get('agentSlugs') as string | null
  const price = parseFloat((formData.get('price') as string) ?? '0')
  const currency = (formData.get('currency') as string) ?? 'KES'

  if (!file || !name || !documentType || !agentSlugsRaw) return c.json(err('file, name, documentType, agentSlugs required'), 400)
  if (!file.name.endsWith('.docx')) return c.json(err('Only .docx files are supported'), 400)

  const agentSlugs = agentSlugsRaw.split(',').map(s => s.trim()).filter(Boolean)
  const id = generateId()
  const slug = slugify(name) + '-' + id.slice(0, 6)
  const r2Key = `templates/${id}/${slug}.docx`
  const ts = now()

  try {
    const docxBuffer = await file.arrayBuffer()
    await c.env.DOCS_BUCKET.put(r2Key, docxBuffer, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } })

    const db = createDb(c.env.DB)
    await db.insert(templates).values({
      id, name, slug, documentType, tier: tier ?? null,
      agentSlugs: JSON.stringify(agentSlugs), r2Key, previewUrl: null,
      fieldSchema: '[]', price, currency, isActive: false,
      extractionStatus: 'processing', createdAt: ts, updatedAt: ts,
    })

    log.info({ id, name, documentType }, 'template:upload:stored')

    c.executionCtx.waitUntil(
      runExtractionPipeline(c.env, docxBuffer, id, name, documentType, tier ?? undefined)
        .then(async (result) => {
          await db.update(templates).set({
            description: result.description, fieldSchema: JSON.stringify(result.fieldSchema),
            extractionStatus: 'done', isActive: true, updatedAt: now(),
          }).where(eq(templates.id, id))
          log.info({ id, fields: result.fieldSchema.length }, 'template:extraction:done')
        })
        .catch(async (e) => {
          await db.update(templates).set({ extractionStatus: 'failed', extractionError: (e as Error).message, updatedAt: now() }).where(eq(templates.id, id))
          log.error({ id, err: e }, 'template:extraction:failed')
        })
    )

    return c.json(ok({ id, slug, name, documentType, extractionStatus: 'processing', message: 'Template uploaded. AI extraction running in background — check status in a few seconds.' }), 202)
  } catch (e) {
    log.error({ err: e }, 'template:upload:error')
    return c.json(err('Upload failed'), 500)
  }
}

export async function updateTemplate(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  const body = await c.req.json() as {
    name?: string; price?: number; currency?: string; agentSlugs?: string[]
    isActive?: boolean; tier?: string; fieldSchema?: unknown[]
  }

  const existing = await db.select().from(templates).where(eq(templates.id, id)).get()
  if (!existing) return c.json(err('Template not found'), 404)

  const patch: Partial<typeof templates.$inferInsert> = { updatedAt: now() }
  if (body.name != null) patch.name = body.name
  if (body.price != null) patch.price = body.price
  if (body.currency != null) patch.currency = body.currency
  if (body.agentSlugs != null) patch.agentSlugs = JSON.stringify(body.agentSlugs)
  if (body.isActive != null) patch.isActive = body.isActive
  if (body.tier != null) patch.tier = body.tier
  if (body.fieldSchema != null) patch.fieldSchema = JSON.stringify(body.fieldSchema)

  await db.update(templates).set(patch).where(eq(templates.id, id))
  const updated = await db.select().from(templates).where(eq(templates.id, id)).get()
  log.info({ id }, 'template:updated')
  return c.json(ok(updated))
}

export async function deleteTemplate(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const id = c.req.param('id')!
  const existing = await db.select().from(templates).where(eq(templates.id, id)).get()
  if (!existing) return c.json(err('Template not found'), 404)
  try { await c.env.DOCS_BUCKET.delete(existing.r2Key) } catch {}
  await db.delete(templates).where(eq(templates.id, id))
  log.info({ id }, 'template:deleted')
  return c.json(ok({ message: 'Template deleted' }))
}

export async function getTemplateSchema(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const row = await db.select().from(templates).where(eq(templates.id, c.req.param('id')!)).get()
  if (!row) return c.json(err('Template not found'), 404)
  const skuSchema: SKUSchema = {
    templateId: row.id, documentType: row.documentType, tier: row.tier ?? undefined,
    fields: JSON.parse(row.fieldSchema) as SKUSchema['fields'],
    confirmPrompt: `I have everything for your *${row.name}*!\n\nReply *Yes* to generate or *No* to change something.`,
  }
  return c.json(ok(skuSchema))
}
