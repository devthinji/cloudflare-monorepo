# Documentation

> One platform. Switchable agents. Documents that change lives.

## What we are building

A multi-tenant conversational document platform where AI agents are configured via a
dashboard and deployed through messaging APIs. Each agent has a name, a purpose, and a
set of tools — but they all share the same infrastructure.

Current agents:
- Taji — reduces unemployment by creating CVs, cover letters, and resignation letters via WhatsApp
- Elim — CBC-aligned exam generation and tutorship for Kenyan students, parents, and institutions

---

## Status (as of 30 June 2026)

Branch `feat/e2e` is ready for end-to-end WhatsApp testing.

What is complete:
- Full 4-stage ConversationMachine (Identify → Auth → Collect → Farewell)
- Blueprint-driven flow (version_1.ts owns all transitions, guards, messages)
- SKU system: 3 active Taji SKUs seeded at test prices (KES 1–3)
- M-Pesa Daraja STK push + callback
- Dashboard wired to real API (agents, SKUs, transactions, documents, customers)
- D1 migrations, seed script, Doppler secrets management
- Pre-flight TypeScript checks pass clean across all workers

What needs e2e confirmation before production:
- Full WhatsApp → machine → M-Pesa → docgen → WhatsApp delivery loop
- docxtemplater render wired to collected field values
- WhatsApp media message for generated .docx file

---

## Index

### 00_overview/
| File | What it covers |
|------|----------------|
| [01-overview.md](00_overview/01-overview.md) | What we're building, current status, philosophy |
| [02-platform.md](00_overview/02-platform.md) | Platform as a configurable agent factory |

### 01_guide/
| File | What it covers |
|------|----------------|
| [01-setup.md](01_guide/01-setup.md) | Local dev setup, secrets, ports |
| [02-testing-e2e.md](01_guide/02-testing-e2e.md) | End-to-end WhatsApp test checklist |

### 02_architecture/
| File | What it covers |
|------|----------------|
| [01-overview.md](02_architecture/01-overview.md) | Workers, service bindings, AI providers, storage |
| [02-conversation-machine.md](02_architecture/02-conversation-machine.md) | 4-stage state machine, SKU pipeline, data flow |
| [03-channels.md](02_architecture/03-channels.md) | WhatsApp-first AAF design |
| [04-database.md](02_architecture/04-database.md) | D1 tables, Drizzle schema, migrations |
| [05-flow_interactivity.md](02_architecture/05-flow_interactivity.md) | WhatsApp interactive messages — buttons, lists, component mapping |

### 03_products/
| File | What it covers |
|------|----------------|
| [01-taji.md](03_products/01-taji.md) | Taji — problem, flows, SKUs |
| [02-elim.md](03_products/02-elim.md) | Elim — problem, flows (post-Taji) |
| [03-agent-model.md](03_products/03-agent-model.md) | How agents are configured |
| [04-pipeline-factory.md](03_products/04-pipeline-factory.md) | PipelineFactory: docx → SKU schema |

### 04_design/
| File | What it covers |
|------|----------------|
| [00-docs-design.md](04_design/00-docs-design.md) | This docs reorganization tasklist |
| [01-staging-plan.md](04_design/01-staging-plan.md) | Build phases and current position |
| [02-audit-101.md](04_design/02-audit-101.md) | AI provider audit (Groq → OpenRouter) |
| [03-tasklist-101.md](04_design/03-tasklist-101.md) | OpenRouter migration tasklist |
| [04-mpesa.md](04_design/04-mpesa.md) | M-Pesa Daraja integration |
| [06-dashboard-db-gap-analysis.md](04_design/06-dashboard-db-gap-analysis.md) | Dashboard ↔ DB/R2 gap analysis (7 issues) |

For AI coding agents: see `AGENTS.md` at repo root and `docs/AGENTS.md`.

---

## Core philosophy

> Same superpowers. Different intentions. One dashboard.

The platform does not change. Only the agent's name, instructions, tools, model, and
API keys change — configured from the admin dashboard. New sellable document types are
added as SKU records, not code changes.
