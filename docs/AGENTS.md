# AI Agent Guide — docs/

This folder is the canonical source for project context. Read `docs/README.md` first for the index, then navigate by category.

## Navigation

| Folder | What's inside |
|--------|---------------|
| `00_overview/` | Project identity, philosophy, current status |
| `01_guide/` | Dev setup, testing, debugging |
| `02_architecture/` | Workers, state machine, database, channels |
| `03_products/` | Taji, Elim, agent model, SKU pipeline |
| `04_design/` | Audits, tasklists, design decisions, roadmap |

## Key conventions from root AGENTS.md

- pnpm only — never npm/yarn
- Turborepo builds — never run tsc/manually inside packages
- Drizzle ORM for DB — no raw SQL in TS
- Hono for all HTTP — no Express/Fastify
- Pino for logging — no console.log in production paths
- Business logic in `version_1.ts` — not in `machine.ts`

## Quick reference

- Database schema: `02_architecture/04-database.md`
- ConversationMachine flow: `02_architecture/02-conversation-machine.md`
- M-Pesa integration: `04_design/04-mpesa.md`
- Current build phase: `04_design/01-staging-plan.md`
- AI provider migration (complete): `04_design/03-tasklist-101.md`
- Dashboard ↔ DB gap analysis: `04_design/06-dashboard-db-gap-analysis.md`
