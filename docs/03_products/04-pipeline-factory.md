# Pipeline Factory — Design Plan

## Overview

A centralized converter registry in the `docgen` worker that accepts any template file type, runs it through a registered handler, and returns a standardized output (placeholder schema, PNG preview, markdown, plain text).

This removes all hardcoded document logic from the codebase. Adding a new sellable template type = register one handler. No other files change.

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

## Architecture

### Factory Interface

```typescript
type ConvertHandler = (file: ArrayBuffer, env: DocgenWorkerEnv) => Promise<ConvertResult>

interface ConvertResult {
  schema?:   SKUFieldSchema[]
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

## ConversationMachine Integration

```typescript
// Before (hardcoded)
const fields = CV_FIELDS

// After (data-driven)
const sku   = await db.query.skus.findFirst({ where: eq(skus.id, templateId) })
const steps = sku.conversationSteps  // JSON from DB — this IS the flow
```

Adding a new Canva presentation SKU = upload → extract → configure → publish.
Zero code changes. Zero deployment.

## Benefits

1. *Zero-code new products* — upload a file, configure in dashboard, go live in minutes
2. *Any file type* — docx, PDF, Canva export, Google Docs, image — all handled via registered converters
3. *Single source of truth* — SKU schema in DB drives the machine, payment, render, and dashboard
4. *Easy to extend* — new converter = one file + one `factory.register()` call
5. *Non-technical admin friendly* — super-admin never touches code to add new offerings
6. *Clean separation* — factory lives in docgen, machine lives in gateway, dashboard is UI over DB

## Caveats

1. docx-to-png requires LibreOffice or a paid API — Cloudflare Workers cannot run LibreOffice
2. Vision AI extraction is probabilistic — needs human review before publishing
3. Google Docs API needs OAuth — not zero-config
4. Large docx files may hit Workers' 128MB memory limit
5. Schema versioning needed — editing a SKU schema mid-conversation can break sessions
6. conversationSteps JSON needs validation before saving to DB
7. R2 storage costs for preview PNGs — set lifecycle rules

## Decision Log

- Placeholder format: `{field_name}` (single curly brace — docxtemplater standard)
- Extractor regex: `\{([^}]+)\}` on raw `word/document.xml` content
- docx-to-png: defer to Phase 2, use Gotenberg or CloudConvert
- Machine integration: SKU steps loaded from DB, cached in KV, invalidated on publish

*Last updated: 2026-06-29*
*Status: Planning — not yet implemented*
