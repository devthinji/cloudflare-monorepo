import { Hono } from 'hono'
import type { DocgenWorkerEnv } from '@repo/types'
import { ok, now } from '@repo/utils'
import { err } from '@repo/utils'
import { createLogger } from '../lib/logger'
import * as TemplatesCtrl from '../controllers/templates'
import * as SkusCtrl      from '../controllers/skus'
import * as DocumentsCtrl from '../controllers/documents'

const app = new Hono<{ Bindings: DocgenWorkerEnv }>()

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-docgen', timestamp: now() })))

app.get('/api/v1/templates',                    TemplatesCtrl.listTemplates)
app.get('/api/v1/templates/:id',                 TemplatesCtrl.getTemplate)
app.get('/api/v1/templates/agent/:agentSlug',    TemplatesCtrl.getTemplatesByAgent)
app.post('/api/v1/templates/upload',             TemplatesCtrl.uploadTemplate)
app.put('/api/v1/templates/:id',                 TemplatesCtrl.updateTemplate)
app.delete('/api/v1/templates/:id',              TemplatesCtrl.deleteTemplate)
app.get('/api/v1/templates/:id/schema',          TemplatesCtrl.getTemplateSchema)

app.post('/api/v1/docgen/skus/upload',           SkusCtrl.uploadSKU)
app.get('/api/v1/docgen/skus',                   SkusCtrl.listSKUs)
app.get('/api/v1/docgen/skus/:id',               SkusCtrl.getSKU)
app.patch('/api/v1/docgen/skus/:id',             SkusCtrl.updateSKU)
app.delete('/api/v1/docgen/skus/:id',            SkusCtrl.deleteSKU)
app.get('/api/v1/docgen/pipelines',              SkusCtrl.listPipelines)

app.post('/api/v1/docgen/render',                DocumentsCtrl.renderDoc)
app.post('/api/v1/docgen/cv',                    DocumentsCtrl.legacyGenerateCv)
app.get('/api/v1/docgen/documents',              DocumentsCtrl.listUserDocs)
app.get('/api/v1/docgen/documents/all',          DocumentsCtrl.listAllDocs)

app.onError((error, c) => { createLogger(c.env).error({ err: error }, 'unhandled docgen error'); return c.json(err('Internal server error'), 500) })

export default app
