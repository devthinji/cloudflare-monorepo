# AGENTS.md — api/docgen

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this worker.

## Purpose

Document generation and template management. Hosts the PipelineFactory that converts
uploaded .docx files into sellable SKU records. Also renders populated documents by
filling docxtemplater placeholders with collected field values and storing the result in R2.

## Cloudflare worker name

`api-docgen`  — local port 8791

## Bindings

| Binding     | Type    | What it is                                      |
|-------------|---------|--------------------------------------------------|
| DB          | D1      | platform-db (reads/writes skus, documents, templates) |
| DOCS_BUCKET | R2      | Template source files + generated document output |
| AI          | Workers AI | @cf/meta/llama-3.1-8b-instruct (field inference) |

## Routes

```
GET  /health

-- Templates (legacy, still active) --
GET    /api/v1/templates                     — list all templates
GET    /api/v1/templates/:id                 — get one template
GET    /api/v1/templates/agent/:agentSlug    — templates for agent
POST   /api/v1/templates/upload              — upload .docx, trigger extraction
PUT    /api/v1/templates/:id                 — update template metadata
DELETE /api/v1/templates/:id                 — delete template
GET    /api/v1/templates/:id/schema          — get extracted field schema

-- SKUs (active pipeline) --
POST   /api/v1/docgen/skus/upload            — upload .docx → PipelineFactory → SKU record
GET    /api/v1/docgen/skus                   — list SKUs (?agentSlug=taji&active=true)
GET    /api/v1/docgen/skus/:id               — get one SKU
PATCH  /api/v1/docgen/skus/:id               — update SKU (price, is_active, etc.)
DELETE /api/v1/docgen/skus/:id               — delete SKU

GET    /api/v1/docgen/pipelines              — list registered pipeline converters

-- Rendering --
POST   /api/v1/docgen/render                 — fill template + return R2 URL
POST   /api/v1/docgen/cv                     — legacy CV generation (deprecated)

-- Documents --
GET    /api/v1/docgen/documents              — list docs for a user
GET    /api/v1/docgen/documents/all          — list all docs (admin)
```

## PipelineFactory

File: `src/pipeline/factory.ts`

Registry of converters keyed by `(inputType, outputType)`.

Current converters:
```
docx → schema       Extract {placeholder} names from word/document.xml
                    AI infers label, type, hint for each field
docx → markdown     mammoth.js readable text version
```

How to add a new converter:
```typescript
pipelineFactory.register('pdf', 'schema', async (file, env) => {
  // extract and return FieldSchema[]
})
```

After a new .docx is uploaded:
1. PipelineFactory runs docx→schema
2. Returns FieldSchema[] (key, label, type, required, hint)
3. ConversationStep[] is auto-generated from field_schema
4. Both are stored in the `skus` table
5. SKU is created with is_active=0 pending admin review

## Document rendering (POST /api/v1/docgen/render)

Request body:
```json
{
  "skuId": "sku-cv-001",
  "fieldValues": { "full_name": "Jane Kamau", "phone": "0712345678", ... },
  "userId": "user-xxx",
  "transactionId": "tx-xxx"
}
```

Flow:
1. Load SKU record from DB → get file_key
2. Fetch .docx template from R2 (file_key)
3. docxtemplater fills {placeholder} values
4. Upload rendered .docx to R2 under `documents/<userId>/<id>.docx`
5. Create document record in DB
6. Return { fileUrl, documentId }

## R2 key conventions

```
templates/<slug>-v<version>.docx    — source templates uploaded via dashboard
templates/<slug>-preview.png         — first page preview image
documents/<userId>/<docId>.docx      — generated documents
```

## Required secrets (via Doppler)

No external API secrets needed for core pipeline.
Workers AI binding is free within the worker via env.AI.

## Key files

```
src/
  index.ts                       — entry point
  routes/index.ts                — all route definitions
  controllers/
    skus.ts                      — SKU CRUD + upload handler (inline skus table schema)
    templates.ts                 — legacy template controller
    documents.ts                 — render + document list
    index.ts                     — controller exports
  pipeline/
    factory.ts                   — PipelineFactory registry + runner
    extractor.ts                 — docx placeholder extraction (unzip + regex)
    field-schema.ts              — FieldSchema type definitions
    interview-engine.ts          — step sequencer (also used by api/agent)
  db/
    schema.ts                    — Drizzle schema for templates + documents tables
  lib/
    logger.ts                    — Pino logger
    cv.ts                        — legacy CV helper
```

## Important note on skus table schema

The `skus` table is defined inline in `src/controllers/skus.ts` as a Drizzle schema
because the docgen worker owns the SKU data model. The migration SQL lives in:
`apps/api/gateway/drizzle/migration/0000_init.sql` (all workers share one migration file).

If you add columns to the skus table, update BOTH files.

## What NOT to do

- Do not call LLM for document filling — docxtemplater is pure template substitution
- Do not store final documents outside R2 — never return binary content from the worker
- Do not add new DB table definitions without updating the gateway migration file
- Do not add conversation flow logic here — that is owned by api/gateway
