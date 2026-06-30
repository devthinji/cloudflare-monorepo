# Docs Reorganization — Tasklist

**Date:** 2026-06-30
**Goal:** Clean and normalize `/docs/` into max 5 root folders + AGENTS.md + README.md.
**Blueprint reference:** CODITECT Production Folder Standard, DOCKit, agentic-docs-templates (Sukitly), SDLC naming standards.

## Rationale

The previous docs folder had 4 numbered folders + 3 loose files (12 content files in nested subdirs). This made navigation hard for both humans and AI agents. New structure organizes by **category** (not chronology) and flattens deep nesting.

## New structure

```
docs/
  AGENTS.md                   ← AI agent entry point: rules, conventions, navigation
  README.md                   ← Project index: what, why, where to look

  00_overview/                ← Project identity, philosophy, current status
    overview.md               ← What we're building, status, core philosophy
    platform.md               ← Platform as configurable agent factory

  01_guide/                   ← Developer onboarding, setup, testing
    setup.md                  ← Local dev setup, first-time, secrets, ports
    testing-e2e.md            ← E2E WhatsApp test checklist, debugging

  02_architecture/            ← Technical architecture
    overview.md               ← 5 workers, service bindings, AI providers, storage
    conversation-machine.md   ← 4-stage state machine, SKU pipeline, data flow
    database.md               ← D1 schema, all 8 tables, Drizzle usage
    channels.md               ← WhatsApp-first AAF design, webhooks, normalisation

  03_products/                ← Agent and SKU documentation
    taji.md                   ← Taji agent: problem, flows, documents
    elim.md                   ← Elim agent: problem, flows, CBC alignment
    agent-model.md            ← Agent configuration model, tools, providers
    pipeline-factory.md       ← SKU pipeline design, converters, lifecycle

  04_design/                  ← Plans, audits, decisions, historical records
    00_docs_design.md         ← THIS FILE: docs reorganization tasklist
    audit-101.md              ← AI provider audit (Groq → OpenRouter)
    tasklist-101.md           ← OpenRouter migration tasklist (3 phases)
    mpesa.md                  ← M-Pesa Daraja integration design
    staging-plan.md           ← Build phases, test checklist, gaps
```

## Tasklist

### Phase 1 — Create new structure
- [x] Create 5 new directories: 00_overview, 01_guide, 02_architecture, 03_products, 04_design
- [x] Consolidate existing content into new files (15 files total)
  - [x] overview.md ← docs/README.md (project info) + architecture/overview.md
  - [x] platform.md ← architecture/platform.md
  - [x] setup.md ← root AGENTS.md (dev setup) + testing/doppler-setup.md
  - [x] testing-e2e.md ← testing/e2e-whatsapp.md
  - [x] overview.md (architecture) ← architecture/overview.md (workers)
  - [x] conversation-machine.md ← architecture/overview.md (machine section)
  - [x] database.md ← database/schema.md
  - [x] channels.md ← api/channels.md
  - [x] taji.md ← products/taji.md
  - [x] elim.md ← products/elim.md
  - [x] agent-model.md ← agents/agent-model.md
  - [x] pipeline-factory.md ← existing pipeline-factory.md
  - [x] audit-101.md ← 00_plan/00_audit-101.md
  - [x] tasklist-101.md ← 01_implementation/00_tasklist-101.md
  - [x] mpesa.md ← payments/mpesa.md
  - [x] staging-plan.md ← roadmap/staging-plan.md

### Phase 2 — Remove old structure
- [ ] Remove `00_plan/` directory
- [ ] Remove `01_implementation/` directory
- [ ] Remove `02_general/` directory (all subdirs and files)
- [ ] Remove `03_design/` directory
- [ ] Remove `pipeline-factory.md` (now in 03_products/)

### Phase 3 — Polish
- [ ] Update `docs/AGENTS.md` with AI agent navigation guide
- [ ] Update `docs/README.md` index to reflect new structure
- [ ] Verify no broken references to old docs paths in codebase
- [ ] Verify git status and commit

## Blueprint sources

This design was informed by:
- **CODITECT Production Folder Standard** — organize by category, not chronology
- **DOCKit** (michaelyurachek) — standardized repository scaffolding with doc hierarchy
- **agentic-docs-templates** (Sukitly) — AGENTS.md + docs/ as AI agent navigation
- **product-template** (pbak95) — design-docs, exec-plans, product-specs structure
- **SDLC naming standards** — NN-kebab-case numbered folder prefixes
- **Slite Engineering Docs Best Practices** (2026) — structure first, then write
