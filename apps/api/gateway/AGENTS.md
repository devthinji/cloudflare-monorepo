# AGENTS.md — api/gateway

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this worker.

## Purpose

Single entry point for ALL traffic. Hosts the ConversationMachine that drives every
user session. Routes to agent, docgen, and payments workers via service bindings.
No business logic lives here except in the machine blueprint.

## Cloudflare worker name

`api-gateway`  — local port 8787

## Bindings

| Binding       | Type     | What it is                        |
|---------------|----------|-----------------------------------|
| DB            | D1       | platform-db (shared, all tables)  |
| SESSIONS_KV   | KV       | Machine state per phone number    |
| AGENT_WORKER  | Service  | api-agent worker                  |
| DOCGEN_WORKER | Service  | api-docgen worker                 |
| PAYMENTS_WORKER | Service | api-payments worker               |

## Routes

```
GET  /health                                — health check (public)

POST /api/v1/auth/login                     — JWT issue (dashboard login)
POST /api/v1/auth/verify                    — verify JWT

POST /api/v1/machine/advance                — ConversationMachine (called by AAF workers)

GET  /api/v1/agent/*                        — proxied to AGENT_WORKER
GET  /api/v1/docgen/*                       — proxied to DOCGEN_WORKER
GET  /api/v1/templates/*                    — proxied to DOCGEN_WORKER
GET  /api/v1/payments/*                     — proxied to PAYMENTS_WORKER

POST /webhooks/*                            — payment callbacks (public, no JWT)
```

## ConversationMachine

Entry: `src/machine/machine.ts`
Blueprint: `src/machine/steps/business-logic/version_1.ts`
States/types: `src/machine/states/index.ts`

The machine is a pure executor. All flow logic lives in version_1.ts — transitions,
guards, messages, and validators. Never add business logic to machine.ts.

Session state is stored in SESSIONS_KV under key `session:<phone>` as serialised JSON.

### 4 stages

```
identify   — look up phone in customers table, classify as new/returning/registered
auth       — collect user's name (first-time only)
collect    — SKU selection → field collection → payment → doc generation → repeat?
farewell   — session closure
```

Sub-stages inside collect:
`sku_select → collection → validation → transaction → transaction_validation → generation → repetition_or_close`

### Interactive hints

`AdvanceResult` includes an optional `interactive: InteractionHint` field that the
WhatsApp worker uses to render buttons/lists instead of plain text. The machine
populates this based on the sub-state:

| Sub-state              | Interactive type | Buttons/List                        |
|------------------------|------------------|-------------------------------------|
| sku_select             | list             | SKU rows from `skuListInteractive()`|
| validation (first)     | buttons          | Yes / Edit                          |
| validation (ambiguous) | buttons          | Yes / Edit (re-shown)               |
| transaction_validation | buttons          | Check again / Cancel                |
| transaction_validation (failed) | buttons  | Try again / Cancel                  |
| generation (docReady)  | buttons          | Create another / I'm done           |
| exit/quit/reset        | buttons          | Confirm reset / Cancel              |
| all others             | none (text)      | Free-form text input                |

The `InteractionHint` type is channel-agnostic — the WhatsApp worker converts it
into Meta Graph API interactive payloads (`button` or `list` type). Button reply
IDs must match guard regexes in version_1.ts (e.g. `yes` matches `isConfirmation`,
`no` matches `isRejection`, `cancel` matches `isCancelCommand`).

## Migrations

All D1 migrations are owned by this worker.

Location: `drizzle/migration/0000_init.sql`
Schema types: `drizzle/schema/database.ts`

To apply locally:
```bash
npx wrangler d1 execute platform-db --local \
  --file=drizzle/migration/0000_init.sql
```

To apply to production:
```bash
npx wrangler d1 execute platform-db --remote \
  --file=drizzle/migration/0000_init.sql
```

## Seed

```bash
# From repo root
pnpm db:seed          # local
pnpm db:seed:remote   # remote
```

Seed source: `drizzle/seed/dev.ts` → compiled to `drizzle/seed/dev.sql`

## Required secrets (via Doppler)

```
JWT_SECRET
OPENROUTER_API_KEY
```

## Key files

```
src/
  index.ts                          — app setup, middleware, route registration
  machine/
    machine.ts                      — pure executor (do not add logic here)
    states/index.ts                 — MachineContext, MachineStage types
    steps/
      business-logic/version_1.ts  — ALL flow logic lives here
    pipelines/index.ts              — pipeline helpers
  routes/
    machine.ts                      — /api/v1/machine/advance handler
    agent.ts                        — proxy to AGENT_WORKER
    docgen.ts                       — proxy to DOCGEN_WORKER
    payments.ts                     — proxy to PAYMENTS_WORKER
    auth.ts                         — JWT issue/verify
    health.ts                       — health check
  middleware/
    auth.ts                         — JWT validation middleware
drizzle/
  migration/0000_init.sql           — single source of truth for all tables
  schema/database.ts                — Drizzle ORM table definitions
  seed/dev.sql                      — test data (agents + 3 SKUs)
  seed/dev.ts                       — seed generator (TypeScript source)
```

## What NOT to do

- Do not add business logic to machine.ts — edit version_1.ts instead
- Do not add new tables in other workers — migrations live here only
- Do not call external APIs directly — route through AGENT_WORKER or DOCGEN_WORKER
- Do not store secrets in wrangler.toml — use Doppler
