import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter'
import { eq, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from './lib/logger'
import { generateCv, type CvData } from './lib/cv'

const app = new Hono<{ Bindings: DocgenWorkerEnv }>()

// ─── Documents table (read/write) ────────────────────────────────────────────

const documents = sqliteTable('documents', {
  id:           text('id').primaryKey(),
  userId:       text('user_id').notNull(),
  agentSlug:    text('agent_slug').notNull(),
  type:         text('type').notNull(),
  title:        text('title').notNull(),
  fileUrl:      text('file_url'),
  templateUsed: text('template_used'),
  metadata:     text('metadata'),
  createdAt:    text('created_at').notNull(),
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

app.use('*', rateLimiter({
  windowMs: 60_000, limit: 60,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-docgen', timestamp: now() })))

// ─── Generate CV ─────────────────────────────────────────────────────────────
// POST /api/v1/docgen/cv
// Body: { userId, agentSlug, data: CvData }

app.post('/api/v1/docgen/cv', async (c) => {
  const log  = createLogger(c.env)
  const db   = drizzle(c.env.DB)
  const body = await c.req.json() as { userId: string; agentSlug: string; data: CvData }

  if (!body.userId || !body.agentSlug || !body.data?.fullName)
    return c.json(err('userId, agentSlug, data.fullName required'), 400)

  try {
    // 1. Generate .docx
    const docBuffer = await generateCv(body.data)

    // 2. Store in R2
    const fileKey = `${body.userId}/cv/${generateId()}.docx`
    await c.env.DOCS_BUCKET.put(fileKey, docBuffer, {
      httpMetadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    })

    // 3. Presigned URL (valid 24h) — R2 public URL or signed
    const fileUrl = `https://docs.yourdomain.com/${fileKey}`  // update with your R2 public domain

    // 4. Save document record
    const id = generateId()
    const ts = now()
    await db.insert(documents).values({
      id, userId: body.userId, agentSlug: body.agentSlug,
      type: 'cv', title: `CV — ${body.data.fullName}`,
      fileUrl, templateUsed: 'cv-professional-v1',
      metadata: JSON.stringify({ fullName: body.data.fullName }),
      createdAt: ts,
    })

    log.info({ userId: body.userId, fileKey }, 'CV generated')
    return c.json(ok({ id, fileUrl, title: `CV — ${body.data.fullName}` }), 201)
  } catch (e) {
    log.error({ err: e }, 'CV generation failed')
    return c.json(err('Document generation failed'), 500)
  }
})

// ─── Generate application letter ─────────────────────────────────────────────
// POST /api/v1/docgen/letter

app.post('/api/v1/docgen/letter', async (c) => {
  const log  = createLogger(c.env)
  const db   = drizzle(c.env.DB)
  const body = await c.req.json() as {
    userId: string; agentSlug: string
    type: 'application_letter' | 'resignation_letter' | 'cover_letter'
    data: { fullName: string; content: string; recipientName?: string; recipientTitle?: string; company?: string }
  }

  if (!body.userId || !body.data?.fullName || !body.data?.content)
    return c.json(err('userId, data.fullName, data.content required'), 400)

  try {
    // Letter docx generation (simplified — full template in lib/letter.ts Phase 2)
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx')
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: now().split('T')[0] })] }),
          new Paragraph({}),
          ...(body.data.recipientName ? [new Paragraph({ children: [new TextRun({ text: body.data.recipientName, bold: true })] })] : []),
          ...(body.data.recipientTitle ? [new Paragraph({ children: [new TextRun({ text: body.data.recipientTitle })] })] : []),
          ...(body.data.company ? [new Paragraph({ children: [new TextRun({ text: body.data.company })] })] : []),
          new Paragraph({}),
          new Paragraph({ children: [new TextRun({ text: body.data.content })] }),
          new Paragraph({}),
          new Paragraph({ children: [new TextRun({ text: 'Yours sincerely,' })] }),
          new Paragraph({}),
          new Paragraph({ children: [new TextRun({ text: body.data.fullName, bold: true })] }),
        ],
      }],
    })

    const docBuffer = await Packer.toBuffer(doc) as unknown as Uint8Array
    const fileKey   = `${body.userId}/${body.type}/${generateId()}.docx`

    await c.env.DOCS_BUCKET.put(fileKey, docBuffer, {
      httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    })

    const fileUrl = `https://docs.yourdomain.com/${fileKey}`
    const id      = generateId()
    const ts      = now()

    await db.insert(documents).values({
      id, userId: body.userId, agentSlug: body.agentSlug ?? 'taji',
      type: body.type, title: `${body.type.replace(/_/g, ' ')} — ${body.data.fullName}`,
      fileUrl, createdAt: ts,
    })

    log.info({ userId: body.userId, type: body.type }, 'letter generated')
    return c.json(ok({ id, fileUrl }), 201)
  } catch (e) {
    log.error({ err: e }, 'letter generation failed')
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
