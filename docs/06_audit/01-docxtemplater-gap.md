# Audit 01: Docxtemplater SKU Render Gap

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: Investigation into "docxtemplater fill not wired to collected field_schema values" — AGENTS.md known gap

---

## 1. Render Pipeline (what exists)

```
fieldValues from conversation
  → Gateway renderDoc service (routes/machine.ts:132)
    → POST /api/v1/docgen/render (docgen/src/controllers/documents.ts)
      → getTemplateBuffer(fileKey)    ← reads .docx from R2
      → renderTemplate(buffer, values) ← docxtemplater fill
      → storeRenderedDoc(buffer)       ← writes to R2
      → insert document record in D1
      → returns { docId, title, fileUrl, key, filename }
```

**All code paths are correctly wired.** The docxtemplater library (`^3.47.0`) is installed, `renderTemplate()` in `renderer.ts` uses PizZip + docxtemplater correctly, and the gateway passes `skuId` and `fieldValues` properly.

## 2. The Real Disconnect

The problem is **not the render code itself** — it's that the seed `.docx` template files don't exist anywhere, so `getTemplateBuffer()` returns null and the render fails silently.

### 2.1 Missing Template Files

The seed data (`gateway/drizzle/seed/dev.ts`) inserts 4 SKUs referencing R2 `fileKey` values. **None of these files exist in the repo or R2:**

| SKU ID | R2 `fileKey` | Price | File Exists? |
|---|---|---|---|
| `sku-cv-professional-001` | `templates/cv-professional-v1.docx` | KES 1 | ❌ |
| `sku-cover-letter-001` | `templates/cover-letter-v1.docx` | KES 2 | ❌ |
| `sku-resignation-001` | `templates/resignation-letter-v1.docx` | KES 3 | ❌ |
| `sku-basic-cv-free-001` | `templates/basic-cv-free-v1.docx` | KES 0 | ❌ |

Only one `.docx` exists in the repo — `public/docx/general_doc.docx` — and it only contains `{doc_title} {doc_body}`, not the field_schema keys.

### 2.2 Hand-Written fieldSchema Keys

The seed data defines `fieldSchema` arrays manually (e.g., `full_name`, `phone`, `email`, etc.) without running the pipeline extraction against a real `.docx`. When the actual template files are created, their `{placeholder}` names must match these keys exactly — otherwise docxtemplater.render() will silently skip them (thanks to `nullGetter: () => ''`).

### 2.3 No Dev Seed Script

There is no script that uploads template `.docx` files to the local R2 instance during `pnpm dev` or `pnpm db:seed`. A fresh clone has no templates to render.

### 2.4 AgentWorker DO Path Broken

The secondary code path (`AgentWorker.ts:243`) sends `templateId` in the request body, but the docgen endpoint (`documents.ts:17`) expects `skuId`. This path is unreachable in the current gateway-driven flow, so it's a latent bug, not an active blocker.

---

## 3. Summary of Disconnects

| # | Disconnect | Severity | Active Blocker? | Location |
|---|---|---|---|---|
| 1 | Seed SKUs reference `.docx` templates that **don't exist** in repo or R2 | **HIGH** | **Yes** — renders fail at `getTemplateBuffer()` → null | `seed/dev.ts` `fileKey` values |
| 2 | Seed `fieldSchema` keys hand-written, not extracted from any `.docx` | **HIGH** | **Yes** — mismatch risk between keys and template placeholders | `seed/dev.ts` `cvFields` etc. |
| 3 | No dev script uploads template `.docx` to local R2 | **HIGH** | **Yes** — fresh clones can't render | (missing artifact) |
| 4 | AgentWorker passes `templateId` but docgen expects `skuId` | **MEDIUM** | No — DO path is deprecated | `AgentWorker.ts:243` vs `documents.ts:17` |
| 5 | AgentWorker has hardcoded prices disconnected from DB | **LOW** | No — DO path deprecated | `AgentWorker.ts:25-28` |
| 6 | Two parallel collection engines (machine.ts + AgentWorker DO) | **LOW** | No — planned architecture | `machine.ts` vs `AgentWorker.ts` |
| 7 | `general_doc.docx` only has `{doc_title}` `{doc_body}` placeholders | **LOW** | No — sample file only | `public/docx/general_doc.docx` |

---

## 4. What Works

- `renderer.ts` — docxtemplater fill code is correct and complete
- `documents.ts renderSKUDoc()` — controller correctly calls renderTemplate + storeRenderedDoc
- Gateway ConversationMachine flow — passes correct `skuId`, `fieldValues`, `fileName`
- PipelineFactory + docx-to-schema — for new SKU uploads via dashboard, extraction and AI inference work correctly
- `nullGetter: () => ''` means no crash on missing placeholders (but renders silently empty)

---

## 5. Resolution (2026-07-01)

All gaps have been closed:

| # | Disconnect | Status | Fix |
|---|---|---|---|
| 1 | Seed SKUs reference `.docx` templates that **don't exist** | ✅ **Fixed** | Generated 4 `.docx` files via `apps/api/docgen/scripts/generate-templates.ts` → `public/docx/templates/` |
| 2 | Seed `fieldSchema` keys hand-written, not extracted from any `.docx` | ✅ **Fixed** | Template `{placeholder}` names now exactly match seed fieldSchema keys (verified via XML inspection) |
| 3 | No dev script uploads template `.docx` to local R2 | ✅ **Fixed** | `scripts/seed-templates.sh` uploads via docgen worker's `POST /api/v1/docgen/seed/template` endpoint, auto-runs in `dev-local.sh` |
| 4 | AgentWorker passes `templateId` but docgen expects `skuId` | ✅ **Fixed** | `AgentWorker.ts:243` changed `templateId` → `skuId` in POST body |
| 5 | AgentWorker has hardcoded prices disconnected from DB | ⬜ Deferred | Not a blocker — DO path is deprecated |
| 6 | Two parallel collection engines | ⬜ Deferred | Intentional architecture |
| 7 | `general_doc.docx` only has `{doc_title}` `{doc_body}` | ⬜ Deferred | Sample file only, not used |

### e2e Verification Results

```
All 4 SKU types rendered successfully:
  ✅ Professional CV      → 10 placeholders substituted, 0 unfilled
  ✅ Cover Letter         → 9 placeholders substituted, 0 unfilled
  ✅ Resignation Letter    → 7 placeholders substituted, 0 unfilled
  ✅ Basic CV (Free)      → 3 placeholders substituted, 0 unfilled

Renders via gateway (X-Internal header):  ✅
Renders direct to docgen:                ✅
Document records in D1:                  ✅ (16 records)
Rendered files in R2:                    ✅
Template name joined in listAllDocs:     ✅
```

### Files Changed

| File | Change |
|------|--------|
| `apps/api/docgen/scripts/generate-templates.ts` | **New** — generates 4 `.docx` templates with matching placeholders |
| `public/docx/templates/cv-professional-v1.docx` | **New** — CV template |
| `public/docx/templates/cover-letter-v1.docx` | **New** — Cover letter template |
| `public/docx/templates/resignation-letter-v1.docx` | **New** — Resignation letter template |
| `public/docx/templates/basic-cv-free-v1.docx` | **New** — Basic CV template |
| `scripts/seed-templates.sh` | **New** — uploads templates to local R2 via docgen seed endpoint |
| `scripts/dev-local.sh` | Modified — calls `seed-templates.sh` after workers start |
| `package.json` | Modified — added `db:seed-templates` script |
| `apps/api/docgen/src/controllers/documents.ts` | Modified — added `seedR2` endpoint |
| `apps/api/docgen/src/routes/index.ts` | Modified — registered `POST /api/v1/docgen/seed/template` |
| `apps/api/agent/src/services/AgentWorker.ts` | Modified — `templateId` → `skuId` in POST body |

See `docs/00_active_right_now/01-docxtemplater-fill.md` for the implementation tasklist (8/8 complete).
