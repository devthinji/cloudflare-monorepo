import type { Context } from 'hono'
import { eq, desc, and } from 'drizzle-orm'
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now, slugify } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { createDb } from '../models'
import { pipelineFactory } from '../pipeline/factory'

export const skus = sqliteTable('skus', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  templateType: text('template_type').notNull(),
  fileKey: text('file_key').notNull(),
  previewKey: text('preview_key'),
  markdownPreview: text('markdown_preview'),
  price: real('price').notNull().default(0),
  currency: text('currency').notNull().default('KES'),
  fieldSchema: text('field_schema').notNull().default('[]'),
  conversationSteps: text('conversation_steps'),
  isActive: integer('is_active').notNull().default(0),
  requiresReview: integer('requires_review').notNull().default(1),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const skuAgentAccess = sqliteTable('sku_agent_access', {
  id: text('id').primaryKey(),
  skuId: text('sku_id').notNull(),
  agentSlug: text('agent_slug').notNull(),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export async function uploadSKU(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger('docgen', c.env)
  const db = createDb(c.env.DB)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const name = formData.get('name') as string
  const agentSlug = formData.get('agentSlug') as string ?? 'default'
  const documentType = formData.get('documentType') as string ?? 'document'
  const price = parseFloat(formData.get('price') as string ?? '200')

  if (!file || !name) return c.json(err('file and name required'), 400)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'docx'
  const supported = pipelineFactory.supports(ext, 'placeholder_schema')
  if (!supported) return c.json(err(`Unsupported file type: .${ext}. Supported: docx, pdf, png, jpg, canva`), 400)

  const fileBuffer = await file.arrayBuffer()
  const fileKey = `templates/${generateId()}.${ext}`
  const skuId = generateId()
  const slug = slugify(`${name}-${skuId.slice(0, 6)}`)
  const ts = now()

  try {
    await c.env.DOCS_BUCKET.put(fileKey, fileBuffer, { httpMetadata: { contentType: file.type } })
    const extraction = await pipelineFactory.run(fileBuffer, ext, 'placeholder_schema', c.env, { templateName: name, documentType })
    if (extraction.error) return c.json(err(`Extraction failed: ${extraction.error}`), 422)

    let markdownPreview: string | undefined
    if (pipelineFactory.supports(ext, 'markdown')) {
      const mdResult = await pipelineFactory.run(fileBuffer, ext, 'markdown', c.env, { templateName: name })
      markdownPreview = mdResult.markdown
    }

    const requiresReview = ext === 'canva' || ext === 'png' || ext === 'jpg' || ext === 'image' ? 1 : 0

    const ts2 = now()
    await db.insert(skus).values({
      id: skuId, name, slug, description: extraction.description,
      templateType: ext, fileKey, markdownPreview, price,
      fieldSchema: JSON.stringify(extraction.placeholder_schema ?? []),
      isActive: 0, requiresReview, version: 1, createdAt: ts, updatedAt: ts,
    })

    await db.insert(skuAgentAccess).values({
      id: generateId(), skuId, agentSlug, enabled: 1, createdAt: ts2, updatedAt: ts2,
    })

    log.info({ skuId, name, ext, fields: extraction.placeholder_schema?.length }, 'sku:uploaded')
    return c.json(ok({
      id: skuId, slug, name, fieldSchema: extraction.placeholder_schema,
      description: extraction.description, markdownPreview,
      requiresReview: !!requiresReview, status: 'draft',
      message: requiresReview ? '⚠️ AI-extracted — please review fields before publishing.' : '✅ Fields extracted. Review and publish when ready.',
    }), 201)
  } catch (e) {
    log.error({ err: e }, 'sku:upload:error')
    return c.json(err('Upload failed'), 500)
  }
}

export async function listSKUs(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const agentSlug = c.req.query('agentSlug')
  const activeOnly = c.req.query('active') === 'true'
  let rows
  if (agentSlug) {
    const joined = await db.select().from(skus)
      .innerJoin(skuAgentAccess, eq(skus.id, skuAgentAccess.skuId))
      .where(and(eq(skuAgentAccess.agentSlug, agentSlug), eq(skuAgentAccess.enabled, 1)))
      .orderBy(desc(skus.createdAt))
    rows = joined.map(r => ({ ...r.skus }))
  } else {
    rows = await db.select().from(skus).orderBy(desc(skus.createdAt))
  }
  const filtered = rows
    .filter(r => activeOnly ? r.isActive === 1 : true)
    .map(r => ({ ...r, fieldSchema: JSON.parse(r.fieldSchema), conversationSteps: r.conversationSteps ? JSON.parse(r.conversationSteps) : null }))
  return c.json(ok(filtered))
}

export async function getSKU(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const row = await db.select().from(skus).where(eq(skus.id, c.req.param('id')!)).get()
  if (!row) return c.json(err('SKU not found'), 404)
  return c.json(ok({ ...row, fieldSchema: JSON.parse(row.fieldSchema), conversationSteps: row.conversationSteps ? JSON.parse(row.conversationSteps) : null }))
}

export async function updateSKU(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const log = createLogger('docgen', c.env)
  const body = await c.req.json() as {
    name?: string; price?: number; fieldSchema?: unknown[]
    conversationSteps?: unknown; isActive?: boolean; description?: string
    agentAccess?: { agentSlug: string; enabled: boolean }[]
  }
  const existing = await db.select().from(skus).where(eq(skus.id, c.req.param('id')!)).get()
  if (!existing) return c.json(err('SKU not found'), 404)

  const updates: Record<string, unknown> = { updatedAt: now() }
  if (body.name !== undefined) updates.name = body.name
  if (body.price !== undefined) updates.price = body.price
  if (body.description !== undefined) updates.description = body.description
  if (body.fieldSchema !== undefined) { updates.fieldSchema = JSON.stringify(body.fieldSchema); updates.version = (existing.version ?? 1) + 1 }
  if (body.conversationSteps !== undefined) updates.conversationSteps = JSON.stringify(body.conversationSteps)
  if (body.isActive !== undefined) { updates.isActive = body.isActive ? 1 : 0; updates.requiresReview = 0 }

  await db.update(skus).set(updates).where(eq(skus.id, c.req.param('id')!))

  if (body.agentAccess !== undefined) {
    const ts = now()
    for (const a of body.agentAccess) {
      const existingRow = await db.select().from(skuAgentAccess)
        .where(and(eq(skuAgentAccess.skuId, c.req.param('id')!), eq(skuAgentAccess.agentSlug, a.agentSlug))).get()
      if (existingRow) {
        await db.update(skuAgentAccess).set({ enabled: a.enabled ? 1 : 0, updatedAt: ts })
          .where(eq(skuAgentAccess.id, existingRow.id))
      } else {
        await db.insert(skuAgentAccess).values({
          id: generateId(), skuId: c.req.param('id')!, agentSlug: a.agentSlug,
          enabled: a.enabled ? 1 : 0, createdAt: ts, updatedAt: ts,
        })
      }
    }
  }

  log.info({ id: c.req.param('id')!, isActive: updates.isActive }, 'sku:updated')
  return c.json(ok({ updated: true, version: updates.version ?? existing.version }))
}

export async function deleteSKU(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const log = createLogger('docgen', c.env)
  const row = await db.select().from(skus).where(eq(skus.id, c.req.param('id')!)).get()
  if (!row) return c.json(err('SKU not found'), 404)
  await c.env.DOCS_BUCKET.delete(row.fileKey).catch(() => {})
  if (row.previewKey) await c.env.DOCS_BUCKET.delete(row.previewKey).catch(() => {})
  await db.delete(skus).where(eq(skus.id, c.req.param('id')!))
  log.info({ id: c.req.param('id')! }, 'sku:deleted')
  return c.json(ok({ deleted: true }))
}

export async function listPipelines(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  return c.json(ok({ converters: pipelineFactory.list() }))
}
