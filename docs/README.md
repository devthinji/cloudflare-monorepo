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
- Dashboard wired to real API (agents, SKUs, transactions, documents, users)
- D1 migrations, seed script, Doppler secrets management
- Pre-flight TypeScript checks pass clean across all workers

What needs e2e confirmation before production:
- Full WhatsApp → machine → M-Pesa → docgen → WhatsApp delivery loop
- docxtemplater render wired to collected field values
- WhatsApp media message for generated .docx file

---

## Index

| File | What it covers |
|------|----------------|
| [architecture/overview.md](architecture/overview.md) | Workers, service bindings, data flow |
| [architecture/platform.md](architecture/platform.md) | Platform as a configurable unit |
| [products/taji.md](products/taji.md) | Taji — problem, flows, SKUs |
| [products/elim.md](products/elim.md) | Elim — problem, flows (post-Taji) |
| [database/schema.md](database/schema.md) | D1 tables, Drizzle schema, migrations |
| [agents/agent-model.md](agents/agent-model.md) | How agents are configured |
| [api/channels.md](api/channels.md) | WhatsApp-first AAF design |
| [pipeline-factory.md](pipeline-factory.md) | PipelineFactory: docx → SKU schema |
| [payments/mpesa.md](payments/mpesa.md) | M-Pesa Daraja integration |
| [testing/doppler-setup.md](testing/doppler-setup.md) | Secrets management via Doppler |
| [testing/e2e-whatsapp.md](testing/e2e-whatsapp.md) | End-to-end WhatsApp test checklist |
| [roadmap/staging-plan.md](roadmap/staging-plan.md) | Build phases and current position |

For AI coding agents: see `AGENTS.md` at the repo root.

---

## Core philosophy

> Same superpowers. Different intentions. One dashboard.

The platform does not change. Only the agent's name, instructions, tools, model, and
API keys change — configured from the admin dashboard. New sellable document types are
added as SKU records, not code changes.
