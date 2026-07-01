# AGENTS.md — Opencode / AI Coding Agent Guide

> This file is the single source of truth for any AI coding agent (Opencode, Claude,
> Cursor, Copilot Workspace, etc.) working on this repository.
> Read it fully before touching any file.

---

## Project in one sentence

A multi-agent conversational platform on Cloudflare Workers where users interact via
WhatsApp to purchase and receive AI-generated documents. Agents and document SKUs are
configured through an admin dashboard — no code deploys needed for new products.

---

## Monorepo layout

```
apps/
  api/
    gateway/     ← Entry point for ALL traffic. ConversationMachine, JWT auth, routing.
    agent/       ← AgentWorker Durable Objects. LLM calls, conversation history.
    docgen/      ← PipelineFactory. Template upload, field extraction, rendering.
    payments/    ← M-Pesa Daraja STK push + callback.
  web/
    pages/
      dashboard/ ← React admin UI. Agents, SKUs, customers, transactions, documents.
      site/      ← Marketing site. Static, no API calls.
    aaf/
      whatsapp/  ← Meta webhook receiver. Interactive messages. Document delivery.
      telegram/  ← Same pattern, Telegram channel.
      sms/       ← Africa's Talking SMS.

packages/
  types/         ← Shared TypeScript interfaces (env bindings, entity types).
  utils/         ← generateId (ULID), slugify, now(), ok/err helpers.
  middleware/    ← Shared Hono middleware: logger, rate-limiter, auth, error-handler.
                   createLogger(service, env) — coloured per-service output.
                   rateLimiter, errorHandler, jwtMiddleware, legacyLogger.

docs/            ← Architecture and product docs. Source of truth.
scripts/         ← dev-local.sh, validate.sh, d1-local-path.sh, color-scheme.sh
public/          ← Static assets. public/docx/general_doc.docx — base template.
```

---

## Absolute rules — never break these

1. Use pnpm. Never npm or yarn. Run `pnpm install` at repo root.
2. Turborepo orchestrates builds. Never run tsc/build manually inside packages.
3. One D1 database: `platform-db`. All workers bind to it. Schema and migrations
   live exclusively in `apps/api/gateway/drizzle/`.
4. Drizzle ORM for all DB access. No raw SQL in TypeScript files — migrations only.
5. Hono for all Cloudflare Workers HTTP. No Express or Fastify.
6. Use `@repo/middleware` for logging. `createLogger(service, env)` — never console.log
   directly in production code paths.
7. Never commit .dev.vars files. Secrets via Doppler.
8. Business logic lives in `version_1.ts` blueprint only. `machine.ts` is a pure
   executor — never add flow logic there.
9. New sellable document type = new SKU record via dashboard. No code change.
10. Git: work in `feat/*`, merge to `dev`, merge to `main` for production.
11. `users` table has been renamed to `customers`. Use `customers` everywhere.

---

## Architecture — data flow

```
WhatsApp user sends message
        │
        ▼
aaf/whatsapp  (Cloudflare Worker, port 8793)
  Verify Meta signature (WHATSAPP_APP_SECRET)
  Normalise phone → +254XXXXXXXXX
  Map phoneNumberId → agentSlug (phone-agent-map.ts)
  Handle /reset, /help, exit, quit commands
  Handle interactive replies (button clicks)
  POST → api/gateway /api/v1/machine/advance
        │
        ▼
api/gateway  ConversationMachine (port 8787)
  Load session from SESSIONS_KV
  Run 4-stage machine (blueprint from version_1.ts)
  Call AGENT_WORKER / DOCGEN_WORKER / PAYMENTS_WORKER via service bindings
  Persist session to SESSIONS_KV
  Return { reply, document?, interactive? }
        │
        ▼
aaf/whatsapp
  If document → deliverDocument() [upload media → send document message]
  If interactive → sendInteractiveMessage() [buttons or list]
  Else → sendReply() [plain text, chunked if > 4000 chars]
```

---

## The 4-stage machine

Location: `apps/api/gateway/src/machine/`

Blueprint (all logic): `steps/business-logic/version_1.ts`
Executor (no logic):   `machine.ts`
Types:                 `states/index.ts`

```
identify → auth → collect → farewell → closed
                     │
               sku_select
               collection
               naming
               validation
               transaction
               transaction_validation
               confirm_generation    ← interactive confirmation before render
               generation
               repetition_or_close
```

Key types in `states/index.ts`:
```typescript
MachineContext       — full session state, serialised to SESSIONS_KV
InteractionHint      — { type: 'buttons'|'list', buttons?, sections?, header?, footer? }
DocDelivery          — { docId, key, filename }
LiveSKU              — { id, name, price, currency, fields: LiveFieldSchema[] }
LiveFieldSchema      — { key, label, hint, type, required, order, choices?, condition? }
CustomerClass        — 'new_unregistered' | 'return_unregistered' | 'registered'
```

---

## Database

Single D1 database: `platform-db`

Migration: `apps/api/gateway/drizzle/migration/0000_init.sql`
Schema:    `apps/api/gateway/drizzle/schema/database.ts`

| Table             | Owner    | Purpose                                          |
|-------------------|----------|--------------------------------------------------|
| agents            | gateway  | Agent configs (slug, system prompt, model)       |
| customers         | gateway  | WhatsApp users (was: users) — phone identified   |
| conversations     | gateway  | One session per customer per agent               |
| messages          | gateway  | All turns in every conversation                  |
| skus              | docgen   | Active sellable products (conversation steps)    |
| sku_agent_access  | docgen   | Which agents can offer which SKUs                |
| documents         | docgen   | Generated file records (R2 URL)                  |
| transactions      | payments | M-Pesa STK push records                          |

Note: `users` was renamed to `customers`. The api/agent controller is now
`controllers/customers.ts`. All references must use `customers`.

---

## Shared middleware package (@repo/middleware)

File: `packages/middleware/src/`

Exports:
```typescript
createLogger(service: string, env?: LoggerEnv)
  → coloured per-service logger with icons
  → dev: pretty-printed to console
  → prod: structured JSON via Pino

requestLogger   → Hono middleware: logs method, path, status, duration
legacyLogger    → backwards-compatible logger wrapper
rateLimiter     → KV-backed rate limiting per IP or userId
errorHandler    → global Hono onError handler
jwtMiddleware   → JWT validation for protected routes
getServiceStyle → per-service color + icon for logging

colors module (c.*):
  c.red, c.green, c.yellow, c.blue, c.cyan, c.gray, c.dim, c.reset, etc.
```

Service colour/icon map (`service-colors.ts`):
```
gateway  → 🌐 cyan
agent    → 🤖 blue
docgen   → 📄 green
payments → 💳 yellow
whatsapp → 📱 magenta
telegram → ✈️  cyan
sms      → 📨 gray
```

Usage in any worker:
```typescript
import { createLogger } from '@repo/middleware'
const log = createLogger('gateway', env)
log.info('message')
log.error({ err }, 'something failed')
```

---

## Local dev setup

### Prerequisites

- Node 20+
- pnpm 9.x (`npm install -g pnpm@9.15.0`)
- Wrangler CLI (`pnpm add -g wrangler`)
- Doppler CLI (https://docs.doppler.com/docs/install-cli)
- ngrok (for WhatsApp webhook exposure)

### First-time setup

```bash
git clone https://github.com/devthinji/cloudflare-monorepo
cd cloudflare-monorepo
pnpm install

doppler login
doppler setup   # project: cloudflare-monorepo, config: dev
```

Add secrets in Doppler dashboard (config: dev):

```
JWT_SECRET
OPENROUTER_API_KEY
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_SHORTCODE          174379
MPESA_CALLBACK_URL       https://<ngrok-url>/webhooks/mpesa
MPESA_ENVIRONMENT        sandbox
WHATSAPP_ACCESS_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_VERIFY_TOKEN
WHATSAPP_PHONE_NUMBER_ID
```

### Start everything

```bash
pnpm dev
```

This runs `scripts/dev-local.sh` which:
1. Kills stale processes on dev ports
2. Injects Doppler secrets into each worker's .dev.vars
3. Runs pre-flight validation
4. Applies D1 migrations locally
5. Starts: gateway (:8787), agent (:8790), docgen (:8791), whatsapp (:8793), dashboard (:5173)
6. Opens Drizzle Studio at https://local.drizzle.studio

### Seed the database

After first `pnpm dev`:
```bash
pnpm db:seed
```

Inserts: Taji + Elim agents, 3 Taji SKUs (KES 1, 2, 3), sku_agent_access, 1 admin.

### Expose WhatsApp webhook

```bash
ngrok http 8793
```

Meta Business Manager:
- Webhook URL: https://<ngrok-id>.ngrok-free.app/webhooks/whatsapp
- Verify Token: WHATSAPP_VERIFY_TOKEN from Doppler
- Subscribe: messages

---

## Current development status

Branch: `feat/e2e`

What is implemented and ready:
- ConversationMachine — 4-stage, blueprint-driven, confirm_generation sub-state
- Interactive messages — WhatsApp buttons + list for SKU menu, confirmations
- Document delivery pipeline — R2 fetch → media upload → WhatsApp document message (3 retries)
- Reset/exit confirmation via interactive buttons
- Phone number ID → agent slug mapping (phone-agent-map.ts)
- Shared middleware package — coloured logger, rate limiter, error handler
- sku_agent_access table — per-agent SKU permissions
- customers table (renamed from users)

What needs e2e confirmation:
- Full WhatsApp → machine → M-Pesa → docgen → delivery loop
- Payment callback receives correctly and triggers document generation
- Document bytes fetched from R2 and delivered via WhatsApp media message

Known gaps (post e2e, pre production):
- docxtemplater fill not wired to collected field_schema values
- Elim agent flow blueprint not built (Taji first)

---

## Key commands

```bash
pnpm dev                  # start all workers + dashboard
pnpm db:seed              # seed local D1
pnpm db:seed:remote       # seed production D1
pnpm run type-check       # tsc --noEmit all packages
pnpm run build            # build all packages
```

Per-worker (cd into worker directory first):
```bash
npx wrangler dev
npx wrangler d1 execute platform-db --local --command "SELECT * FROM skus"
npx wrangler tail
```

---

## Service ports

| Worker       | Port | Gateway binding  |
|--------------|------|------------------|
| api-gateway  | 8787 | (entry point)    |
| api-agent    | 8790 | AGENT_WORKER     |
| api-docgen   | 8791 | DOCGEN_WORKER    |
| api-payments | 8792 | PAYMENTS_WORKER  |
| aaf-whatsapp | 8793 | (calls gateway)  |
| dashboard    | 5173 | (standalone Vite)|

---

## File conventions

- All IDs: ULID via `generateId()` from `@repo/utils`
- All timestamps: ISO 8601 via `now()` from `@repo/utils`
- All DB: Drizzle ORM, never raw SQL in TypeScript
- All results: `ok(data)` / `err(message)` from `@repo/utils`
- All logging: `createLogger(service, env)` from `@repo/middleware`

---

## Adding a new SKU (no code change)

1. Upload .docx via dashboard (TemplatesPage) or POST to /api/v1/docgen/skus/upload
2. PipelineFactory extracts {placeholders}, AI infers field labels
3. Set is_active = 1 and price in dashboard
4. Add sku_agent_access row to give the right agent access
5. SKU is live immediately

---

## Collaboration protocol

1. Clem (Base44 Superagent) — architecture, scaffolding, docs, cross-cutting changes
2. Local dev (Opencode CLI) — feature implementation, testing, fixes

Workflow:
1. Clem pushes architecture/scaffolding to feat/e2e
2. Local dev pulls, implements, pushes back to feat/e2e
3. feat/e2e → PR → dev → PR → main
4. Never push directly to main

When changes affect: machine.ts types, DB schema, middleware API, or phone-agent-map —
update the relevant AGENTS.md section before pushing.
