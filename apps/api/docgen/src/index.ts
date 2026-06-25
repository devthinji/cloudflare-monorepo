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
import { InterviewEngine } from './pipeline/interview-engine'
import type { SKUSchema, CollectionState } from './pipeline/field-schema'

const app = new Hono<{ Bindings: DocgenWorkerEnv }>()

// ─── Rate limiting ────────────────────────────────────────────────────────────

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
