# Docxtemplater Fill — Implementation Tasklist

> **Source audit:** `docs/06_audit/01-docxtemplater-gap.md`
> **Created:** 2026-07-01
> **Branch:** feat/e2e
> **Milestone:** Wire docxtemplater fill to collected field_schema values
> **Completion:** 8 / 8 tasks (100%)

---

## Progress Tracker

```
[███████████████████████████████] 100%
```

| Phase | Tasks | Done |
|-------|-------|------|
| F — Create template .docx files | 4 | 4 |
| G — Seed + dev workflow | 2 | 2 |
| H — AgentWorker bugfix | 1 | 1 |
| I — e2e verification | 1 | 1 |

**Total:** 8 / 8

---

## Phase F: Create Template `.docx` Files

Create 4 real `.docx` files with `{placeholder}` names that **exactly match** the seed `fieldSchema` keys from `seed/dev.ts`. Each template must use snake_case `{key}` syntax matching the field keys — otherwise docxtemplater.render() will silently skip mismatched fields.

- [x] **F1** — Create `templates/cv-professional-v1.docx`
  - Placeholders to match fieldSchema: `{full_name}`, `{phone}`, `{email}`, `{location}`, `{job_title}`, `{summary}`, `{experience}`, `{education}`, `{skills}`, `{languages}`
  - Must be a real CV layout (sections for summary, experience, education, skills)
- [x] **F2** — Create `templates/cover-letter-v1.docx`
  - Placeholders: `{full_name}`, `{phone}`, `{email}`, `{recruiter_name}`, `{company_name}`, `{job_title}`, `{body}`
- [x] **F3** — Create `templates/resignation-letter-v1.docx`
  - Placeholders: `{full_name}`, `{position}`, `{manager_name}`, `{company_name}`, `{last_working_day}`, `{reason}`
- [x] **F4** — Create `templates/basic-cv-free-v1.docx`
  - Placeholders: `{full_name}`, `{phone}`, `{email}`, `{skills}`

> **How to create:** Use [`docxtemplater` CLI](https://docxtemplater.com/docs/cli/) or a script that writes a minimal `.docx` with the correct `{placeholder}` text in `word/document.xml`. Repo root has `public/docx/general_doc.docx` as a reference shell.

---

## Phase G: Seed + Dev Workflow

Make template files available in local R2 on every `pnpm dev`.

- [x] **G1** — Add `scripts/seed-templates.sh` that uploads the 4 `.docx` files to local R2
  - Bucket: `platform-docs` (same as `DOCS_BUCKET` binding)
  - Use `wrangler r2 object put` or a simple Node script with `@cloudflare/workers-r2` SDK
  - Upload to keys: `templates/cv-professional-v1.docx`, etc.
  - Run after `pnpm db:seed` in dev flow
- [x] **G2** — Hook into `scripts/dev-local.sh` or add a `pnpm db:seed-templates` script
  - Must only run when `WRANGLER_DEV=1` or equivalent (not on production)
  - Check if files already uploaded to avoid redundant PUTs

---

## Phase H: AgentWorker Bugfix

If the AgentWorker DO path is kept (secondary collection engine):

- [x] **H1** — Fix `AgentWorker.ts:243` to send `skuId` instead of `templateId`
  - Locate the method that calls `triggerRender(docxData, templateId)`
  - Change to `triggerRender(docxData, skuId)` and update the body
  - Or keep backward compat: docgen endpoint accepts either `skuId` or `templateId`

---

## Phase I: e2e Verification

- [x] **I1** — Full end-to-end render test
  - Run `pnpm dev` with fresh D1 + R2
  - Upload all 4 templates (via G1)
  - Simulate a conversation: SKU selection → field collection → confirm generation
  - Verify rendered `.docx` has all placeholders substituted
  - Verify document record created in D1
  - Verify R2 has the rendered file at `rendered/{userId}/{skuId}/{docId}.docx`
  - Download and inspect: open in Word/LibreOffice, confirm all `{placeholders}` replaced

---

## Milestone Plan

### ✅ M4: "Templates Exist" (Phase F) — COMPLETED
Template `.docx` files with matching placeholders available in the repo.
```
F1 F2 F3 F4  →  4/4 tasks ✅
```

### ✅ M5: "Dev Flow Complete" (Phase G) — COMPLETED
Templates auto-uploaded to local R2 during dev setup.
```
G1 G2  →  2/2 tasks ✅
```

### ✅ M6: "e2e Render Verified" (Phases H+I) — COMPLETED
End-to-end render pipeline confirmed working.
```
H1 I1  →  2/2 tasks ✅
```

---

## How to update progress

When completing a task, mark it `[x]` and update the counter at the top:

```
**Completion:** 3 / 8 tasks (37%)
```

Use the visual bar:
```
[██████░░░░░░░░░░░░░░░░░░░░░] 37%
```

Where each `█` = ~3.3% (30 blocks total).
