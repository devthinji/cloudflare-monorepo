import type { Context } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '../lib/logger'
import { templates, documents, createDb } from '../models'
import { renderTemplate } from '../lib/renderer'
import { getTemplateBuffer, storeRenderedDoc, docDownloadKey } from '../lib/storage'
import { generateCv, type CvData } from '../lib/cv'

export async function renderDoc(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const body = await c.req.json() as {
    userId: string; agentSlug: string; templateId: string
    fieldValues: Record<string, unknown>; transactionId?: string
  }

  if (!body.userId || !body.templateId || !body.fieldValues) return c.json(err('userId, templateId, fieldValues required'), 400)

  const tmpl = await db.select().from(templates).where(eq(templates.id, body.templateId)).get()
  if (!tmpl) return c.json(err('Template not found'), 404)
  if (!tmpl.isActive) return c.json(err('Template is not active'), 400)

  try {
    const r2Obj = await c.env.DOCS_BUCKET.get(tmpl.r2Key)
    if (!r2Obj) return c.json(err('Template file not found in storage'), 500)
    const docxBuffer = await r2Obj.arrayBuffer()

    let docxText = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(docxBuffer)
    for (const [key, value] of Object.entries(body.fieldValues)) {
      docxText = docxText.replaceAll(`{${key}}`, String(value ?? ''))
    }
    const outBuffer = new TextEncoder().encode(docxText)

    const fileKey = `documents/${body.userId}/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, outBuffer, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } })
    const fileUrl = `https://docs.yourdomain.com/${fileKey}`

    const id = generateId()
    await db.insert(documents).values({
      id, userId: body.userId, agentSlug: body.agentSlug,
      templateId: body.templateId, type: tmpl.documentType,
      title: `${tmpl.name} — ${body.fieldValues.full_name ?? body.fieldValues.name ?? body.userId}`,
      fileUrl, fieldValues: JSON.stringify(body.fieldValues),
      transactionId: body.transactionId ?? null, createdAt: now(),
    })

    log.info({ userId: body.userId, templateId: body.templateId }, 'docgen:render:done')
    return c.json(ok({ id, fileUrl, title: tmpl.name }), 201)
  } catch (e) {
    log.error({ err: e }, 'docgen:render:error')
    return c.json(err('Render failed'), 500)
  }
}

export async function renderSKUDoc(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const body = await c.req.json() as {
    userId: string; skuId: string; fieldValues: Record<string, unknown>
  }

  if (!body.userId || !body.skuId || !body.fieldValues) return c.json(err('userId, skuId, fieldValues required'), 400)

  const sku = await db.select().from(skus).where(eq(skus.id, body.skuId)).get()
  if (!sku) return c.json(err('SKU not found'), 404)
  if (!sku.isActive) return c.json(err('SKU is not active'), 400)

  const templateBuffer = await getTemplateBuffer(c.env, sku.fileKey)
  if (!templateBuffer) return c.json(err('Template file not found in storage'), 404)

  const docId = generateId()
  const safe = sku.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const filename = `${safe}-${docId.slice(0, 6)}.docx`

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
    id: docId, userId: body.userId, agentSlug: sku.agentSlug,
    templateId: sku.id, type: sku.templateType,
    title: `${sku.name} — ${body.userId}`, fileUrl,
    fieldValues: JSON.stringify(body.fieldValues), createdAt: ts,
  })

  log.info({ docId, skuId: body.skuId, userId: body.userId }, 'render:done')
  return c.json(ok({ docId, title: `${sku.name}`, fileUrl, filename }), 201)
}

import { skus } from './skus'

export async function legacyGenerateCv(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const body = await c.req.json() as { userId: string; agentSlug: string; data: CvData }
  if (!body.userId || !body.agentSlug || !body.data?.fullName) return c.json(err('userId, agentSlug, data.fullName required'), 400)

  try {
    const docBuffer = await generateCv(body.data)
    const fileKey = `${body.userId}/cv/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, docBuffer, { httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } })
    const fileUrl = `https://docs.yourdomain.com/${fileKey}`
    const id = generateId()
    await db.insert(documents).values({ id, userId: body.userId, agentSlug: body.agentSlug, type: 'cv', title: `CV — ${body.data.fullName}`, fileUrl, createdAt: now() })
    log.info({ userId: body.userId, fileKey }, 'cv:legacy:generated')
    return c.json(ok({ id, fileUrl, title: `CV — ${body.data.fullName}` }), 201)
  } catch (e) {
    log.error({ err: e }, 'cv:legacy:error')
    return c.json(err('Document generation failed'), 500)
  }
}

export async function listUserDocs(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const userId = c.req.query('userId')
  if (!userId) return c.json(err('userId required'), 400)
  const rows = await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt)).limit(50)
  return c.json(ok(rows.map(r => ({ ...r, fieldValues: r.fieldValues ? JSON.parse(r.fieldValues) : null }))))
}

export async function listAllDocs(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(100)
  return c.json(ok(rows))
}

export async function listUserDocsByPath(c: Context<{ Bindings: DocgenWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(documents).where(eq(documents.userId, c.req.param('userId')!)).orderBy(desc(documents.createdAt))
  return c.json(ok(rows))
}
