import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter'
import { eq, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now, slugify } from '@repo/utils'
import { createLogger } from './lib/logger'
import { generateCv, type CvData } from './lib/cv'
import { templates, documents } from './db/schema'
import { runExtractionPipeline } from './pipeline/extractor'
import { pipelineFactory }       from './pipeline/factory'
import { registerAllConverters } from './pipeline/converters'
import { InterviewEngine } from './pipeline/interview-engine'
import type { SKUSchema, CollectionState } from './pipeline/field-schema'

const app = new Hono<{ Bindings: DocgenWorkerEnv }>()

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Register pipeline converters at startup
registerAllConverters()

app.use('*', rateLimiter({
  windowMs: 60_000, limit: 60,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-docgen', timestamp: now() })))

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE (SKU) ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── List all templates ───────────────────────────────────────────────────────
// GET /api/v1/templates

app.get('/api/v1/templates', async (c) => {
  const db   = drizzle(c.env.DB)
  const rows = await db.select().from(templates).orderBy(desc(templates.createdAt))
  return c.json(ok(rows))
})

// ─── Get single template ──────────────────────────────────────────────────────
// GET /api/v1/templates/:id

app.get('/api/v1/templates/:id', async (c) => {
  const db  = drizzle(c.env.DB)
  const row = await db.select().from(templates).where(eq(templates.id, c.req.param('id'))).get()
  if (!row) return c.json(err('Template not found'), 404)
  return c.json(ok(row))
})

// ─── Get templates by agent slug ──────────────────────────────────────────────
// GET /api/v1/templates/agent/:agentSlug

app.get('/api/v1/templates/agent/:agentSlug', async (c) => {
  const db   = drizzle(c.env.DB)
  const slug = c.req.param('agentSlug')
  // Filter: agentSlugs JSON array contains the slug, and isActive = true
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.isActive, true))
    .orderBy(templates.documentType, templates.price)
  // Filter in JS (D1 doesn't support JSON_CONTAINS yet)
  const filtered = rows.filter(r => {
    try { return (JSON.parse(r.agentSlugs) as string[]).includes(slug) }
    catch { return false }
  })
  return c.json(ok(filtered))
})

// ─── Upload template (multipart) ─────────────────────────────────────────────
// POST /api/v1/templates/upload
// Form fields: file (.docx), name, documentType, tier?, agentSlugs (comma-sep), price, currency?

app.post('/api/v1/templates/upload', async (c) => {
  const log = createLogger(c.env)

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json(err('Expected multipart/form-data'), 400)
  }

  const file         = formData.get('file') as File | null
  const name         = formData.get('name') as string | null
  const documentType = formData.get('documentType') as string | null
  const tier         = formData.get('tier') as string | null
  const agentSlugsRaw = formData.get('agentSlugs') as string | null
  const price        = parseFloat((formData.get('price') as string) ?? '0')
  const currency     = (formData.get('currency') as string) ?? 'KES'

  if (!file || !name || !documentType || !agentSlugsRaw)
    return c.json(err('file, name, documentType, agentSlugs required'), 400)

  if (!file.name.endsWith('.docx'))
    return c.json(err('Only .docx files are supported'), 400)

  const agentSlugs = agentSlugsRaw.split(',').map(s => s.trim()).filter(Boolean)
  const id         = generateId()
  const slug       = slugify(name) + '-' + id.slice(0, 6)
  const r2Key      = `templates/${id}/${slug}.docx`
  const ts         = now()

  try {
    // 1. Store .docx in R2
    const docxBuffer = await file.arrayBuffer()
    await c.env.DOCS_BUCKET.put(r2Key, docxBuffer, {
      httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })

    // 2. Save template row as "processing"
    const db = drizzle(c.env.DB)
    await db.insert(templates).values({
      id, name, slug,
      documentType,
      tier:             tier ?? null,
      agentSlugs:       JSON.stringify(agentSlugs),
      r2Key,
      previewUrl:       null,
      fieldSchema:      '[]',
      price,
      currency,
      isActive:         false,
      extractionStatus: 'processing',
      createdAt:        ts,
      updatedAt:        ts,
    })

    log.info({ id, name, documentType }, 'template:upload:stored')

    // 3. Run AI extraction pipeline (async — don't block upload response)
    const groqKey = c.env.GROQ_API_KEY
    c.executionCtx.waitUntil(
      runExtractionPipeline(groqKey, docxBuffer, id, name, documentType, tier ?? undefined)
        .then(async (result) => {
          await db.update(templates).set({
            description:      result.description,
            fieldSchema:      JSON.stringify(result.fieldSchema),
            extractionStatus: 'done',
            isActive:         true,
            updatedAt:        now(),
          }).where(eq(templates.id, id))
          log.info({ id, fields: result.fieldSchema.length }, 'template:extraction:done')
        })
        .catch(async (e) => {
          await db.update(templates).set({
            extractionStatus: 'failed',
            extractionError:  (e as Error).message,
            updatedAt:        now(),
          }).where(eq(templates.id, id))
          log.error({ id, err: e }, 'template:extraction:failed')
        })
    )

    return c.json(ok({
      id, slug, name, documentType,
      extractionStatus: 'processing',
      message: 'Template uploaded. AI extraction running in background — check status in a few seconds.',
    }), 202)

  } catch (e) {
    log.error({ err: e }, 'template:upload:error')
    return c.json(err('Upload failed'), 500)
  }
})

// ─── Update template metadata (price, agents, activate/deactivate) ────────────
// PUT /api/v1/templates/:id

app.put('/api/v1/templates/:id', async (c) => {
  const log  = createLogger(c.env)
  const db   = drizzle(c.env.DB)
  const id   = c.req.param('id')
  const body = await c.req.json() as {
    name?:        string
    price?:       number
    currency?:    string
    agentSlugs?:  string[]
    isActive?:    boolean
    tier?:        string
    fieldSchema?: unknown[]   // admin can manually tweak extracted schema
  }

  const existing = await db.select().from(templates).where(eq(templates.id, id)).get()
  if (!existing) return c.json(err('Template not found'), 404)

  const patch: Partial<typeof templates.$inferInsert> = { updatedAt: now() }
  if (body.name        != null) patch.name        = body.name
  if (body.price       != null) patch.price       = body.price
  if (body.currency    != null) patch.currency    = body.currency
  if (body.agentSlugs  != null) patch.agentSlugs  = JSON.stringify(body.agentSlugs)
  if (body.isActive    != null) patch.isActive    = body.isActive
  if (body.tier        != null) patch.tier        = body.tier
  if (body.fieldSchema != null) patch.fieldSchema = JSON.stringify(body.fieldSchema)

  await db.update(templates).set(patch).where(eq(templates.id, id))
  const updated = await db.select().from(templates).where(eq(templates.id, id)).get()
  log.info({ id }, 'template:updated')
  return c.json(ok(updated))
})

// ─── Delete template ──────────────────────────────────────────────────────────
// DELETE /api/v1/templates/:id

app.delete('/api/v1/templates/:id', async (c) => {
  const log = createLogger(c.env)
  const db  = drizzle(c.env.DB)
  const id  = c.req.param('id')

  const existing = await db.select().from(templates).where(eq(templates.id, id)).get()
  if (!existing) return c.json(err('Template not found'), 404)

  // Delete from R2 first
  try { await c.env.DOCS_BUCKET.delete(existing.r2Key) } catch {}

  await db.delete(templates).where(eq(templates.id, id))
  log.info({ id }, 'template:deleted')
  return c.json(ok({ message: 'Template deleted' }))
})

// ─── Get SKU schema for interview engine ──────────────────────────────────────
// GET /api/v1/templates/:id/schema

app.get('/api/v1/templates/:id/schema', async (c) => {
  const db  = drizzle(c.env.DB)
  const row = await db.select().from(templates).where(eq(templates.id, c.req.param('id'))).get()
  if (!row) return c.json(err('Template not found'), 404)

  const skuSchema: SKUSchema = {
    templateId:    row.id,
    documentType:  row.documentType,
    tier:          row.tier ?? undefined,
    fields:        JSON.parse(row.fieldSchema) as SKUSchema['fields'],
    confirmPrompt: `I have everything for your *${row.name}*!\n\nReply *Yes* to generate or *No* to change something.`,
  }
  return c.json(ok(skuSchema))
})

// ══════════════════════════════════════════════════════════════════════════════
// RENDER ENDPOINT — called by agent after interview is complete
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/v1/docgen/render
// Body: { userId, agentSlug, templateId, fieldValues, transactionId? }

app.post('/api/v1/docgen/render', async (c) => {
  const log  = createLogger(c.env)
  const db   = drizzle(c.env.DB)
  const body = await c.req.json() as {
    userId:         string
    agentSlug:      string
    templateId:     string
    fieldValues:    Record<string, unknown>
    transactionId?: string
  }

  if (!body.userId || !body.templateId || !body.fieldValues)
    return c.json(err('userId, templateId, fieldValues required'), 400)

  const tmpl = await db.select().from(templates).where(eq(templates.id, body.templateId)).get()
  if (!tmpl) return c.json(err('Template not found'), 404)
  if (!tmpl.isActive) return c.json(err('Template is not active'), 400)

  try {
    // Fetch .docx from R2
    const r2Obj = await c.env.DOCS_BUCKET.get(tmpl.r2Key)
    if (!r2Obj) return c.json(err('Template file not found in storage'), 500)

    const docxBuffer = await r2Obj.arrayBuffer()

    // Fill placeholders using docxtemplater pattern
    // Simple regex replace for {key} → value
    // Full docxtemplater would be used here in production
    let docxText = new TextDecoder('utf-8', { fatal: false }).decode(docxBuffer)
    for (const [key, value] of Object.entries(body.fieldValues)) {
      docxText = docxText.replaceAll(`{${key}}`, String(value ?? ''))
    }
    const outBuffer = new TextEncoder().encode(docxText)

    // Store rendered document in R2
    const fileKey = `documents/${body.userId}/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, outBuffer, {
      httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })

    const fileUrl = `https://docs.yourdomain.com/${fileKey}` // replace with R2 public domain

    // Save document record
    const id = generateId()
    await db.insert(documents).values({
      id,
      userId:        body.userId,
      agentSlug:     body.agentSlug,
      templateId:    body.templateId,
      type:          tmpl.documentType,
      title:         `${tmpl.name} — ${body.fieldValues.full_name ?? body.fieldValues.name ?? body.userId}`,
      fileUrl,
      fieldValues:   JSON.stringify(body.fieldValues),
      transactionId: body.transactionId ?? null,
      createdAt:     now(),
    })

    log.info({ userId: body.userId, templateId: body.templateId }, 'docgen:render:done')
    return c.json(ok({ id, fileUrl, title: tmpl.name }), 201)

  } catch (e) {
    log.error({ err: e }, 'docgen:render:error')
    return c.json(err('Render failed'), 500)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// LEGACY — direct CV / letter generation (kept for backwards compat)
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/v1/docgen/cv', async (c) => {
  const log  = createLogger(c.env)
  const db   = drizzle(c.env.DB)
  const body = await c.req.json() as { userId: string; agentSlug: string; data: CvData }

  if (!body.userId || !body.agentSlug || !body.data?.fullName)
    return c.json(err('userId, agentSlug, data.fullName required'), 400)

  try {
    const docBuffer = await generateCv(body.data)
    const fileKey   = `${body.userId}/cv/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, docBuffer, {
      httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })
    const fileUrl = `https://docs.yourdomain.com/${fileKey}`
    const id      = generateId()
    await db.insert(documents).values({
      id, userId: body.userId, agentSlug: body.agentSlug,
      type: 'cv', title: `CV — ${body.data.fullName}`,
      fileUrl, createdAt: now(),
    })
    log.info({ userId: body.userId, fileKey }, 'cv:legacy:generated')
    return c.json(ok({ id, fileUrl, title: `CV — ${body.data.fullName}` }), 201)
  } catch (e) {
    log.error({ err: e }, 'cv:legacy:error')
    return c.json(err('Document generation failed'), 500)
  }
})

// ─── List user documents ──────────────────────────────────────────────────────

app.get('/api/v1/docgen/documents/:userId', async (c) => {
  const db   = drizzle(c.env.DB)
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, c.req.param('userId')))
    .orderBy(desc(documents.createdAt))
  return c.json(ok(rows))
})

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((error, c) => {
  createLogger(c.env).error({ err: error }, 'unhandled docgen error')
  return c.json(err('Internal server error'), 500)
})

export default app

// ══════════════════════════════════════════════════════════════════════════════
// SKU ENDPOINTS — factory-powered
// ══════════════════════════════════════════════════════════════════════════════

// ─── Drizzle SKU table (inline until migration runs) ─────────────────────────
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

const skus = sqliteTable('skus', {
  id:                 text('id').primaryKey(),
  name:               text('name').notNull(),
  slug:               text('slug').notNull(),
  description:        text('description'),
  agentSlug:          text('agent_slug').notNull(),
  templateType:       text('template_type').notNull(),
  fileKey:            text('file_key').notNull(),
  previewKey:         text('preview_key'),
  markdownPreview:    text('markdown_preview'),
  price:              real('price').notNull().default(0),
  currency:           text('currency').notNull().default('KES'),
  fieldSchema:        text('field_schema').notNull().default('[]'),
  conversationSteps:  text('conversation_steps'),
  isActive:           integer('is_active').notNull().default(0),
  requiresReview:     integer('requires_review').notNull().default(1),
  version:            integer('version').notNull().default(1),
  createdAt:          text('created_at').notNull(),
  updatedAt:          text('updated_at').notNull(),
})

// ─── POST /api/v1/docgen/skus/upload ─────────────────────────────────────────
// Upload template file → factory extracts schema → returns draft SKU for review

app.post('/api/v1/docgen/skus/upload', async (c) => {
  const log = createLogger(c.env)
  const db  = drizzle(c.env.DB)

  const formData     = await c.req.formData()
  const file         = formData.get('file') as File | null
  const name         = formData.get('name') as string
  const agentSlug    = formData.get('agentSlug') as string ?? 'taji'
  const documentType = formData.get('documentType') as string ?? 'document'
  const price        = parseFloat(formData.get('price') as string ?? '200')

  if (!file || !name) return c.json(err('file and name required'), 400)

  const ext       = file.name.split('.').pop()?.toLowerCase() ?? 'docx'
  const supported = pipelineFactory.supports(ext, 'placeholder_schema')
  if (!supported) {
    return c.json(err(`Unsupported file type: .${ext}. Supported: docx, pdf, png, jpg, canva`), 400)
  }

  const fileBuffer = await file.arrayBuffer()
  const fileKey    = `templates/${generateId()}.${ext}`
  const skuId      = generateId()
  const slug       = slugify(`${name}-${skuId.slice(0, 6)}`)
  const ts         = now()

  try {
    // 1. Store original file in R2
    await c.env.DOCS_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: file.type },
    })

    // 2. Run factory extraction pipeline
    const extraction = await pipelineFactory.run(
      fileBuffer, ext, 'placeholder_schema', c.env,
      { templateName: name, documentType },
    )

    if (extraction.error) {
      return c.json(err(`Extraction failed: ${extraction.error}`), 422)
    }

    // 3. Run markdown conversion in parallel (non-blocking)
    let markdownPreview: string | undefined
    if (pipelineFactory.supports(ext, 'markdown')) {
      const mdResult = await pipelineFactory.run(fileBuffer, ext, 'markdown', c.env, { templateName: name })
      markdownPreview = mdResult.markdown
    }

    // 4. Determine if AI-extracted (requires review)
    const requiresReview = ext === 'canva' || ext === 'png' || ext === 'jpg' || ext === 'image' ? 1 : 0

    // 5. Save draft SKU to DB
    await db.insert(skus).values({
      id:              skuId,
      name,
      slug,
      description:     extraction.description,
      agentSlug,
      templateType:    ext,
      fileKey,
      markdownPreview,
      price,
      fieldSchema:     JSON.stringify(extraction.placeholder_schema ?? []),
      isActive:        0,           // always draft until admin publishes
      requiresReview,
      version:         1,
      createdAt:       ts,
      updatedAt:       ts,
    })

    log.info({ skuId, name, ext, fields: extraction.placeholder_schema?.length }, 'sku:uploaded')

    return c.json(ok({
      id:             skuId,
      slug,
      name,
      fieldSchema:    extraction.placeholder_schema,
      description:    extraction.description,
      markdownPreview,
      requiresReview: !!requiresReview,
      status:         'draft',
      message:        requiresReview
        ? '⚠️ AI-extracted — please review fields before publishing.'
        : '✅ Fields extracted. Review and publish when ready.',
    }), 201)

  } catch (e) {
    log.error({ err: e }, 'sku:upload:error')
    return c.json(err('Upload failed'), 500)
  }
})

// ─── GET /api/v1/docgen/skus ──────────────────────────────────────────────────
// List all SKUs (admin) or active SKUs by agent (agent worker)

app.get('/api/v1/docgen/skus', async (c) => {
  const db        = drizzle(c.env.DB)
  const agentSlug = c.req.query('agentSlug')
  const activeOnly = c.req.query('active') === 'true'

  const rows = await db.select().from(skus).orderBy(desc(skus.createdAt))
  const filtered = rows
    .filter(r => agentSlug   ? r.agentSlug === agentSlug   : true)
    .filter(r => activeOnly  ? r.isActive  === 1           : true)
    .map(r => ({ ...r, fieldSchema: JSON.parse(r.fieldSchema), conversationSteps: r.conversationSteps ? JSON.parse(r.conversationSteps) : null }))

  return c.json(ok(filtered))
})

// ─── GET /api/v1/docgen/skus/:id ─────────────────────────────────────────────

app.get('/api/v1/docgen/skus/:id', async (c) => {
  const db  = drizzle(c.env.DB)
  const row = await db.select().from(skus).where(eq(skus.id, c.req.param('id'))).get()
  if (!row) return c.json(err('SKU not found'), 404)
  return c.json(ok({ ...row, fieldSchema: JSON.parse(row.fieldSchema), conversationSteps: row.conversationSteps ? JSON.parse(row.conversationSteps) : null }))
})

// ─── PATCH /api/v1/docgen/skus/:id ───────────────────────────────────────────
// Admin edits fields, price, steps — or publishes (isActive: true)

app.patch('/api/v1/docgen/skus/:id', async (c) => {
  const db   = drizzle(c.env.DB)
  const log  = createLogger(c.env)
  const body = await c.req.json() as {
    name?:              string
    price?:             number
    agentSlug?:         string
    fieldSchema?:       unknown[]
    conversationSteps?: unknown
    isActive?:          boolean
    description?:       string
  }

  const existing = await db.select().from(skus).where(eq(skus.id, c.req.param('id'))).get()
  if (!existing) return c.json(err('SKU not found'), 404)

  const updates: Partial<typeof existing> = { updatedAt: now() }
  if (body.name         !== undefined) updates.name        = body.name
  if (body.price        !== undefined) updates.price       = body.price
  if (body.agentSlug    !== undefined) updates.agentSlug   = body.agentSlug
  if (body.description  !== undefined) updates.description = body.description
  if (body.fieldSchema  !== undefined) {
    updates.fieldSchema = JSON.stringify(body.fieldSchema)
    updates.version     = (existing.version ?? 1) + 1  // bump version on schema change
  }
  if (body.conversationSteps !== undefined) updates.conversationSteps = JSON.stringify(body.conversationSteps)
  if (body.isActive     !== undefined) {
    updates.isActive      = body.isActive ? 1 : 0
    updates.requiresReview = 0   // publishing clears review flag
  }

  await db.update(skus).set(updates).where(eq(skus.id, c.req.param('id')))
  log.info({ id: c.req.param('id'), isActive: updates.isActive }, 'sku:updated')
  return c.json(ok({ updated: true, version: updates.version ?? existing.version }))
})

// ─── DELETE /api/v1/docgen/skus/:id ──────────────────────────────────────────

app.delete('/api/v1/docgen/skus/:id', async (c) => {
  const db  = drizzle(c.env.DB)
  const log = createLogger(c.env)
  const row = await db.select().from(skus).where(eq(skus.id, c.req.param('id'))).get()
  if (!row) return c.json(err('SKU not found'), 404)
  // Delete from R2 too
  await c.env.DOCS_BUCKET.delete(row.fileKey).catch(() => {})
  if (row.previewKey) await c.env.DOCS_BUCKET.delete(row.previewKey).catch(() => {})
  await db.delete(skus).where(eq(skus.id, c.req.param('id')))
  log.info({ id: c.req.param('id') }, 'sku:deleted')
  return c.json(ok({ deleted: true }))
})

// ─── GET /api/v1/docgen/pipelines ────────────────────────────────────────────
// List registered converters — useful for dashboard to know what's supported

app.get('/api/v1/docgen/pipelines', (c) =>
  c.json(ok({ converters: pipelineFactory.list() }))
)
