# AGENTS.md — api/docgen

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this worker.

## Purpose

Document generation and template management. Hosts the PipelineFactory that converts
uploaded .docx files into SKU records with extracted field schemas and conversation steps.
Renders populated documents by filling docxtemplater placeholders with collected field
values, stores output in R2, and returns a download URL.

## Worker name / local port

`api-docgen` — port 8791

## Bindings

| Binding     | Type       | What it is                                           |
|-------------|------------|------------------------------------------------------|
| DB          | D1         | platform-db (skus, documents, templates)             |
| DOCS_BUCKET | R2         | Template source files + generated document output    |
| AI          | Workers AI | @cf/meta/llama-3.1-8b-instruct (field inference)     |

## Routes

```
GET  /health

-- SKUs (primary pipeline) --
POST   /api/v1/docgen/skus/upload       — upload .docx → PipelineFactory → SKU record
GET    /api/v1/docgen/skus              — list (?agentSlug=taji&active=true)
GET    /api/v1/docgen/skus/:id
PATCH  /api/v1/docgen/skus/:id          — update price, is_active, name, etc.
DELETE /api/v1/docgen/skus/:id
GET    /api/v1/docgen/pipelines         — list registered pipeline converters

-- Document rendering --
POST   /api/v1/docgen/render            — fill template + upload to R2 + return URL
GET    /api/v1/docgen/download          — ?key=<r2-key> — stream document bytes
GET    /api/v1/docgen/documents         — list documents for a user
GET    /api/v1/docgen/documents/all     — list all documents (admin)

-- Templates (legacy, still active) --
GET    /api/v1/templates
GET    /api/v1/templates/:id
GET    /api/v1/templates/agent/:agentSlug
POST   /api/v1/templates/upload
PUT    /api/v1/templates/:id
DELETE /api/v1/templates/:id
GET    /api/v1/templates/:id/schema
```

## PipelineFactory

File: `src/pipeline/factory.ts`

Registry of converters keyed by `(inputType, outputType)`.

Registered converters:
```
docx → schema     unzip word/document.xml, regex \{([^}]+)\},
                  AI infers label/type/hint per field
docx → markdown   mammoth.js readable text version
```

To add a new converter:
```typescript
pipelineFactory.register('pdf', 'schema', async (file, env) => {
  // return FieldSchema[]
})
```

## SKU upload flow

1. POST multipart/form-data to /api/v1/docgen/skus/upload
2. Worker saves .docx to R2 under `templates/<slug>-v<n>.docx`
3. PipelineFactory.run('docx', 'schema') extracts placeholders
4. AI infers field labels, types, validation hints
5. ConversationStep[] auto-generated from field_schema
6. SKU record created in D1 with is_active=0 and requires_review=1
7. Admin reviews in dashboard, sets price, toggles is_active=1
8. SKU is live to agents immediately — no code deploy

## Document render flow

POST /api/v1/docgen/render body:
```json
{
  "skuId": "sku-cv-001",
  "fieldValues": { "full_name": "Jane Kamau", "phone": "0712345678" },
  "userId": "user-xxx",
  "transactionId": "tx-xxx"
}
```

1. Load SKU from D1 → get file_key
2. Fetch .docx template from R2
3. docxtemplater fills {placeholder} values
4. Upload rendered .docx to R2: `documents/<userId>/<docId>.docx`
5. Create document record in D1
6. Return { fileUrl, documentId, key, filename }

## Document download (GET /api/v1/docgen/download)

Called internally by aaf/whatsapp to fetch the rendered file bytes for delivery.
The AAF worker calls this via the API_GATEWAY service binding.

## R2 key conventions

```
templates/<slug>-v<version>.docx       — uploaded source templates
templates/<slug>-preview.png            — preview image
documents/<userId>/<docId>.docx         — generated output files
```

## sku_agent_access table

Controls which agents can offer which SKUs. A SKU may be active but restricted
to specific agents.

To give agent 'taji' access to SKU 'sku-cv-001':
```sql
INSERT INTO sku_agent_access (id, sku_id, agent_slug, enabled, created_at, updated_at)
VALUES ('...', 'sku-cv-001', 'taji', 1, '...', '...')
```

The seed already inserts access rows for all 3 test SKUs → taji.

## Required secrets (Doppler)

None — Workers AI binding is free in-process via env.AI.

## Key files

```
src/
  index.ts
  routes/index.ts
  controllers/
    skus.ts          — SKU upload, CRUD, pipeline trigger
    templates.ts     — legacy template controller
    documents.ts     — render, download, list
    index.ts
  pipeline/
    factory.ts                          — PipelineFactory registry + runner
    extractor.ts                        — docx unzip + placeholder regex
    field-schema.ts                     — FieldSchema types
    interview-engine.ts                 — step sequencer
    converters/
      docx-to-schema.ts
      docx-to-markdown.ts
  db/schema.ts
  lib/logger.ts
  lib/cv.ts          — legacy CV helper
```

## Rules

- No LLM calls for document filling — docxtemplater is pure substitution
- No binary content returned directly from endpoints — always use R2 + URL
- No new table definitions without updating gateway migration file
- No conversation flow logic — owned by api/gateway
