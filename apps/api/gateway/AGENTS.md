# AGENTS.md — api/gateway

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this worker.

## Purpose

Single entry point for ALL traffic. Hosts the ConversationMachine that drives every
user session. Routes to agent, docgen, and payments workers via service bindings.
The machine is a pure executor — all flow logic lives in the blueprint file only.

## Worker name / local port

`api-gateway` — port 8787

## Bindings

| Binding          | Type    | What it is                                     |
|------------------|---------|------------------------------------------------|
| DB               | D1      | platform-db (all tables live here)             |
| SESSIONS_KV      | KV      | Machine context per phone number               |
| AGENT_WORKER     | Service | api-agent                                      |
| DOCGEN_WORKER    | Service | api-docgen                                     |
| PAYMENTS_WORKER  | Service | api-payments                                   |

## Routes

```
GET  /health

POST /api/v1/auth/login           — JWT issue (dashboard login)
POST /api/v1/auth/verify          — verify JWT

POST /api/v1/machine/advance      — ConversationMachine (called by AAF workers)

GET  /api/v1/agent/*              — proxied to AGENT_WORKER
GET  /api/v1/docgen/*             — proxied to DOCGEN_WORKER
GET  /api/v1/templates/*          — proxied to DOCGEN_WORKER
GET  /api/v1/payments/*           — proxied to PAYMENTS_WORKER

POST /webhooks/*                  — payment callbacks (public, no JWT)
```

## ConversationMachine

Entry:    `src/machine/machine.ts`    ← pure executor, no logic here
Blueprint:`src/machine/steps/business-logic/version_1.ts` ← ALL flow logic
States:   `src/machine/states/index.ts`

Session state is serialised JSON stored in SESSIONS_KV under key `session:<phone>`.

### 5-stage flow

```
identify → auth → collect → farewell → closed
                     │
               sku_select
               collection
               naming
               validation
               transaction
               transaction_validation
               confirm_generation     ← NEW: interactive confirmation before doc render
               generation
               repetition_or_close
```

### Key types (src/machine/states/index.ts)

```typescript
MachineContext       — full session state serialised to KV
MachineStage         — 'identify' | 'auth' | 'collect' | 'farewell' | 'closed'
CollectSubState      — sku_select | collection | naming | validation |
                       transaction | transaction_validation | confirm_generation |
                       generation | repetition_or_close
CustomerClass        — 'new_unregistered' | 'return_unregistered' | 'registered'
InteractionHint      — { type: 'buttons'|'list', buttons?, sections?, ... }
DocDelivery          — { docId, key, filename } — returned after generation
LiveSKU              — { id, name, price, currency, fields: LiveFieldSchema[] }
LiveFieldSchema      — { key, label, hint, type, required, order, choices?, condition? }
```

### Interactive messages

The machine can return an `InteractionHint` alongside the reply text.
The AAF worker reads this and sends a WhatsApp interactive message (buttons or list)
instead of plain text. Use `InteractionHint` for: SKU menus, Yes/No confirmations,
payment confirmation, generation confirmation.

## Database — migrations live here

Location: `drizzle/migration/0000_init.sql`
Schema:   `drizzle/schema/database.ts`

Tables in this migration:
- `agents`, `admins`
- `customers` (renamed from users — phone-identified WhatsApp users)
- `conversations`, `messages`
- `documents`, `templates`
- `skus`, `sku_agent_access`
- `transactions`

Important: `users` → renamed to `customers`. The api/agent worker uses `customers.ts`
controller (was users.ts). Update any references accordingly.

Apply migrations:
```bash
# local
npx wrangler d1 execute platform-db --local \
  --file=drizzle/migration/0000_init.sql \
  --config=wrangler.toml

# remote
npx wrangler d1 execute platform-db --remote \
  --file=drizzle/migration/0000_init.sql \
  --config=wrangler.toml
```

## Seed

```bash
pnpm db:seed          # local
pnpm db:seed:remote   # remote
```

Seed inserts: Taji + Elim agents, 3 Taji SKUs (KES 1–3), sku_agent_access rows, 1 admin.

## Required secrets (Doppler)

```
JWT_SECRET
OPENROUTER_API_KEY
```

## Key files

```
src/
  index.ts
  machine/
    machine.ts                          — pure executor (do NOT add logic here)
    states/index.ts                     — all types: MachineContext, stages, hints
    steps/business-logic/version_1.ts  — ALL flow logic, transitions, guards, messages
    pipelines/index.ts
  routes/
    machine.ts     — /api/v1/machine/advance
    agent.ts       — proxy to AGENT_WORKER
    docgen.ts      — proxy to DOCGEN_WORKER
    payments.ts    — proxy to PAYMENTS_WORKER
    auth.ts
    health.ts
  middleware/auth.ts
drizzle/
  migration/0000_init.sql    — single source of truth for ALL tables
  schema/database.ts         — Drizzle ORM definitions
  seed/dev.sql               — test data
  seed/dev.ts                — seed generator
```

## Rules

- Never add business logic to machine.ts — only version_1.ts
- Never add table migrations in any other worker — only here
- Never call external APIs from the gateway — proxy to the right worker
