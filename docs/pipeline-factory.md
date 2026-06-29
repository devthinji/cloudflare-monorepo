# Pipeline Factory — Design Plan

## Overview

A centralized converter registry in the `docgen` worker that accepts any template file type, runs it through a registered handler, and returns a standardized output (placeholder schema, PNG preview, markdown, plain text).

This removes all hardcoded document logic from the codebase. Adding a new sellable template type = register one handler. No other files change.

---

## Core Concept

```
PipelineFactory
  .register(inputType, outputType, handler)
  .run(file, inputType, outputType) → result
```

### Registered Converters (Planned)

| Input   | Output               | Method                          |
|---------|----------------------|---------------------------------|
| docx    | placeholder_schema   | Unzip + regex `\{([^}]+)\}`     |
| docx    | png                  | LibreOffice headless / sharp    |
| docx    | markdown             | mammoth.js                      |
| pdf     | txt                  | pdf-parse / pdfjs               |
| pdf     | placeholder_schema   | txt extraction + regex          |
| canva   | placeholder_schema   | Vision AI (Cloudflare Workers AI) |
| gdoc    | placeholder_schema   | Google Docs API named ranges    |
| image   | placeholder_schema   | Vision AI OCR + field detection |

### Placeholder Format

docxtemplater uses single curly braces: `{field_name}`

The extractor regex: `\{([^}]+)\}` on the raw XML inside `word/document.xml`

---

## Architecture

### Files to Create

```
apps/api/docgen/src/pipeline/
  factory.ts                  ← registry + runner (core)
  converters/
    docx-to-schema.ts         ← extract {placeholders} from docx
    docx-to-png.ts            ← generate preview image
    docx-to-markdown.ts       ← readable text version
    pdf-to-txt.ts             ← raw text extraction
    pdf-to-schema.ts          ← placeholder extraction from pdf
    vision-to-schema.ts       ← AI-powered extraction (canva, image, gdoc)
  extractor.ts                ← existing file, refactored to use factory
```

### Factory Interface

```typescript
type ConvertHandler = (file: ArrayBuffer, env: DocgenWorkerEnv) => Promise<ConvertResult>

interface ConvertResult {
  schema?:   SKUFieldSchema[]    // for placeholder_schema output
  fileKey?:  string              // R2 key for stored output
  text?:     string              // for txt/markdown output
  error?:    string
}

class PipelineFactory {
  register(input: string, output: string, handler: ConvertHandler): void
  run(file: ArrayBuffer, input: string, output: string, env: DocgenWorkerEnv): Promise<ConvertResult>
  supports(input: string, output: string): boolean
}
```

---

## SKU Lifecycle (End to End)

```
1. Admin uploads file via Dashboard
        ↓
2. docgen worker receives file → stores in R2
        ↓
3. factory.run(file, 'docx', 'placeholder_schema')
        ↓
4. Returns draft SKUFieldSchema[]
        ↓
5. Admin reviews fields in Dashboard (reorder, label, validate, set price)
        ↓
6. Admin publishes SKU → saved to skus table in D1
        ↓
7. ConversationMachine loads SKU steps at runtime
        ↓
8. User on WhatsApp gets asked exactly the fields defined in the SKU
        ↓
9. Payment → render → delivery
```

---

## Dashboard SKU Studio (4 Screens)

1. *Upload* — drag & drop any template file
2. *Review* — see extracted fields, reorder, rename, set validation rules
3. *Configure* — set price, assign to agent (Taji/Elim), set active/inactive
4. *Preview* — see conversation as it will appear on WhatsApp

---

## ConversationMachine Integration

The machine currently has hardcoded stages. After this plan is implemented:

```typescript
// Before (hardcoded)
const fields = CV_FIELDS

// After (data-driven)
const sku   = await db.query.skus.findFirst({ where: eq(skus.id, templateId) })
const steps = sku.conversationSteps  // JSON from DB — this IS the flow
```

Adding a new Canva presentation SKU = upload → extract → configure → publish.
Zero code changes. Zero deployment.

---

## Execution Tasklist

### Phase 1 — Foundation
- [ ] Create `factory.ts` — PipelineFactory class with register/run/supports
- [ ] Create `converters/docx-to-schema.ts` — unzip docx, parse XML, regex `{placeholders}`
- [ ] Refactor existing `extractor.ts` to use factory
- [ ] Add `skus` table to D1 with fields: id, name, price, agentSlug, templateType, fileKey, schema (JSON), conversationSteps (JSON), isActive, createdAt, updatedAt
- [ ] Write D1 migration `0003_skus.sql`

### Phase 2 — More Converters
- [ ] `converters/docx-to-png.ts` — preview image for dashboard
- [ ] `converters/docx-to-markdown.ts` — human-readable field context
- [ ] `converters/pdf-to-txt.ts` — raw text extraction
- [ ] `converters/vision-to-schema.ts` — Cloudflare Workers AI vision for Canva/images

### Phase 3 — Machine Integration
- [ ] Update `ConversationMachine` to load SKU steps from DB at runtime
- [ ] Remove all hardcoded prices/fields from TajiAgent and machine.ts
- [ ] Add `GET /api/v1/docgen/skus?agentSlug=taji` endpoint
- [ ] Add `POST /api/v1/docgen/skus` — create SKU from extracted schema
- [ ] Add `PATCH /api/v1/docgen/skus/:id` — update fields/price/status
- [ ] Add `DELETE /api/v1/docgen/skus/:id`

### Phase 4 — Dashboard SKU Studio
- [ ] Upload screen — file picker, type detection, trigger extraction
- [ ] Review screen — field list, drag to reorder, inline edit labels/validation
- [ ] Configure screen — price input, agent selector, active toggle
- [ ] Preview screen — simulated WhatsApp conversation thread

### Phase 5 — Real-time Updates
- [ ] KV cache for SKU schemas (invalidate on publish)
- [ ] Dashboard shows live "conversation preview" as fields are edited
- [ ] Webhook or Durable Object broadcast when SKU is updated mid-conversation

---

## Benefits

1. *Zero-code new products* — upload a file, configure in dashboard, go live in minutes
2. *Any file type* — docx, PDF, Canva export, Google Docs, image — all handled via registered converters
3. *Single source of truth* — SKU schema in DB drives the machine, the payment amount, the render, and the dashboard display
4. *Easy to extend* — new converter = one file + one `factory.register()` call
5. *Non-technical admin friendly* — super-admin never touches code to add new offerings
6. *Conversation preview* — see exactly what users will experience before publishing
7. *Clean separation* — factory lives in docgen, machine lives in gateway, dashboard is just a UI over the DB

---

## Caveats

1. *docx-to-png requires LibreOffice or a paid API* — Cloudflare Workers cannot run LibreOffice. Options: use a micro VM (Cloudflare Containers, currently in beta), call an external API (CloudConvert, Gotenberg), or skip PNG preview and use markdown instead for now.

2. *Vision AI extraction is probabilistic* — Canva/image extraction relies on AI guessing field names. Will need human review before publishing. Never auto-publish vision-extracted SKUs.

3. *Google Docs API needs OAuth* — requires a connected Google account from the super-admin. Not zero-config.

4. *Large docx files* — Cloudflare Workers have a 128MB memory limit and 10ms CPU time on free tier (scales with paid). Very large templates with many images may hit limits.

5. *Schema versioning* — if you edit a SKU schema after users have started a conversation, their in-progress sessions may break. Need a schema version field and migration strategy.

6. *Conversation steps JSON is powerful but needs validation* — a badly formed `conversationSteps` JSON will break the machine silently. Dashboard must validate before saving.

7. *R2 storage costs* — preview PNGs add up. Set a lifecycle rule to delete unused previews after 30 days.

---

## Decision Log

- Placeholder format: `{field_name}` (single curly brace — docxtemplater standard)
- Extractor regex: `\{([^}]+)\}` on raw `word/document.xml` content
- docx-to-png: defer to Phase 2, use Gotenberg or CloudConvert (not LibreOffice in Workers)
- Machine integration: SKU steps loaded from DB, cached in KV, invalidated on publish
- Dashboard preview: simulated WhatsApp thread rendered client-side from steps JSON

---

*Last updated: 2026-06-29*
*Status: Planning — not yet implemented*
