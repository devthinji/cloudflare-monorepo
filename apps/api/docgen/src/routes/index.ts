import { Hono } from 'hono'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, now } from '@repo/utils'
import { err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { requestLogger } from '@repo/middleware'
import * as SkusCtrl      from '../controllers/skus'
import * as DocumentsCtrl from '../controllers/documents'

const app = new Hono<{ Bindings: DocgenWorkerEnv }>()

app.use('*', requestLogger('docgen'))

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-docgen', timestamp: now() })))

app.post('/api/v1/docgen/skus/upload',           SkusCtrl.uploadSKU)
app.get('/api/v1/docgen/skus',                   SkusCtrl.listSKUs)
app.get('/api/v1/docgen/skus/:id',               SkusCtrl.getSKU)
app.patch('/api/v1/docgen/skus/:id',             SkusCtrl.updateSKU)
app.delete('/api/v1/docgen/skus/:id',            SkusCtrl.deleteSKU)
app.get('/api/v1/docgen/pipelines',              SkusCtrl.listPipelines)

app.post('/api/v1/docgen/render',                DocumentsCtrl.renderSKUDoc)
app.post('/api/v1/docgen/cv',                    DocumentsCtrl.legacyGenerateCv)
app.get('/api/v1/docgen/documents',              DocumentsCtrl.listUserDocs)
app.get('/api/v1/docgen/documents/all',          DocumentsCtrl.listAllDocs)
app.get('/api/v1/docgen/download',               DocumentsCtrl.downloadDoc)
app.post('/api/v1/docgen/seed/template',          DocumentsCtrl.seedR2)

app.onError((error, c) => { createLogger('docgen', c.env).error({ err: error }, 'unhandled docgen error'); return c.json(err('Internal server error'), 500) })

export default app
