import type { Context } from 'hono'
import { eq, desc, inArray } from 'drizzle-orm'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { documents, skus, createDb } from '../models'
import { renderTemplate } from '../lib/renderer'
import { getTemplateBuffer, storeRenderedDoc, docDownloadKey } from '../lib/storage'
import { generateCv, type CvData } from '../lib/cv'

// ─── SKU render ───────────────────────────────────────────────────────────────

export async function renderSKUDoc(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger('docgen', c.env)
  const db = createDb(c.env.DB)
  const body = await c.req.json() as {
    userId: string; agentSlug: string; skuId: string; fieldValues: Record<string, unknown>; fileName?: string
  }

  if (!body.userId || !body.agentSlug || !body.skuId || !body.fieldValues) return c.json(err('userId, agentSlug, skuId, fieldValues required'), 400)

  const sku = await db.select().from(skus).where(eq(skus.id, body.skuId)).get()
  if (!sku) return c.json(err('SKU not found'), 404)
  if (!sku.isActive) return c.json(err('SKU is not active'), 400)

  const templateBuffer = await getTemplateBuffer(c.env, sku.fileKey)
  if (!templateBuffer) return c.json(err('Template file not found in storage'), 404)

  const docId = generateId()
  const safe = sku.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const userSafe = body.fileName ? body.fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) : ''
  const filename = userSafe ? `${userSafe}.docx` : `${safe}-${docId.slice(0, 6)}.docx`

  let rendered
  try {
    rendered = await renderTemplate({ templateBuffer, fieldValues: body.fieldValues }, filename)
  } catch (e) {
    log.error({ err: e, skuId: body.skuId }, 'render:failed')
    return c.json(err(`Render failed: ${e instanceof Error ? e.message : String(e)}`), 500)
  }

  const key = docDownloadKey(body.userId, body.skuId, docId)
  const fileUrl = await storeRenderedDoc(c.env, key, rendered.buffer, filename)

  const ts = now()
  await db.insert(documents).values({
    id: docId, userId: body.userId, agentSlug: body.agentSlug,
    templateId: sku.id, type: sku.templateType,
    title: `${sku.name} — ${body.userId}`, fileUrl,
    fieldValues: JSON.stringify(body.fieldValues), createdAt: ts,
  })

  log.info({ docId, skuId: body.skuId, userId: body.userId }, 'render:done')
  return c.json(ok({ docId, title: `${sku.name}`, fileUrl, key, filename }), 201)
}

// ─── Legacy CV generator ──────────────────────────────────────────────────────

export async function legacyGenerateCv(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger('docgen', c.env)
  const db = createDb(c.env.DB)
  const body = await c.req.json() as { userId: string; agentSlug: string; data: CvData }
  if (!body.userId || !body.agentSlug || !body.data?.fullName) return c.json(err('userId, agentSlug, data.fullName required'), 400)

  try {
    const docBuffer = await generateCv(body.data)
    const fileKey = `${body.userId}/cv/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, docBuffer, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } })
    const id = generateId()
    await db.insert(documents).values({ id, userId: body.userId, agentSlug: body.agentSlug, type: 'cv', title: `CV — ${body.data.fullName}`, fileUrl: fileKey, createdAt: now() })
    log.info({ userId: body.userId, fileKey }, 'cv:legacy:generated')
    return c.json(ok({ id, fileKey, title: `CV — ${body.data.fullName}` }), 201)
  } catch (e) {
    log.error({ err: e }, 'cv:legacy:error')
    return c.json(err('Document generation failed'), 500)
  }
}

// ─── List user docs ───────────────────────────────────────────────────────────

export async function listUserDocs(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const userId = c.req.query('userId')
  if (!userId) return c.json(err('userId required'), 400)
  const rows = await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt)).limit(50)
  return c.json(ok(rows.map(r => ({ ...r, fieldValues: r.fieldValues ? JSON.parse(r.fieldValues) : null }))))
}

// ─── List all docs (admin) — FIX: parse fieldValues + join SKU name ──────────

export async function listAllDocs(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(100)

  // Collect all unique templateIds to batch-fetch SKU names
  const skuIds = [...new Set(rows.map(r => r.templateId).filter(Boolean))] as string[]
  const skuMap: Record<string, string> = {}
  if (skuIds.length > 0) {
    const skuRows = await db.select({ id: skus.id, name: skus.name }).from(skus).where(inArray(skus.id, skuIds))
    for (const s of skuRows) skuMap[s.id] = s.name
  }

  return c.json(ok(rows.map(r => ({
    ...r,
    fieldValues:  r.fieldValues ? JSON.parse(r.fieldValues) : null,
    templateName: r.templateId ? (skuMap[r.templateId] ?? null) : null,
  }))))
}

// ─── List user docs by path param ────────────────────────────────────────────

export async function listUserDocsByPath(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(documents).where(eq(documents.userId, c.req.param('userId')!)).orderBy(desc(documents.createdAt))
  return c.json(ok(rows.map(r => ({ ...r, fieldValues: r.fieldValues ? JSON.parse(r.fieldValues) : null }))))
}

// ─── Seed template to R2 (internal/dev only) ──────────────────────────────────

export async function seedR2(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger('docgen', c.env)
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const key = formData.get('key') as string | null
  if (!file || !key) return c.json(err('file and key required'), 400)
  const buffer = await file.arrayBuffer()
  await c.env.DOCS_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })
  log.info({ key, size: buffer.byteLength }, 'seed:uploaded')
  return c.json(ok({ key, size: buffer.byteLength }), 201)
}

// ─── Download doc by R2 key ───────────────────────────────────────────────────

export async function downloadDoc(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const key = c.req.query('key')
  const docId = c.req.query('docId')

  let r2Key = key
  if (!r2Key && docId) {
    const db = createDb(c.env.DB)
    const doc = await db.select().from(documents).where(eq(documents.id, docId)).get()
    if (doc?.fileUrl) r2Key = doc.fileUrl
  }

  if (!r2Key) return c.json(err('key or docId required'), 400)

  const obj = await c.env.DOCS_BUCKET.get(r2Key)
  if (!obj) return c.json(err('File not found in storage'), 404)

  const buffer = await obj.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="document.docx"',
    },
  })
}
