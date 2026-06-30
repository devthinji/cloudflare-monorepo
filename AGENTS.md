# AGENTS.md — Opencode / AI Coding Agent Guide

> This file is the single source of truth for any AI coding agent (Opencode, Claude,
> Cursor, Copilot Workspace, etc.) working on this repository.
> Read it fully before touching any file.

---

## Project in one sentence

A multi-agent conversational platform on Cloudflare Workers where users interact via
WhatsApp to purchase and receive AI-generated documents. Agents and document SKUs are
configured entirely through a dashboard — no code deploys needed for new products.

---

## Monorepo layout

```
apps/
  api/
    gateway/     ← Entry point for ALL traffic. JWT auth, ConversationMachine, routing.
    agent/       ← Durable Objects (TajiAgent, ElimAgent). LLM calls, doc generation.
    docgen/      ← PipelineFactory. Template upload, placeholder extraction, SKU CRUD.
    payments/    ← M-Pesa Daraja STK push + callback handling.
  web/
    dashboard/   ← React admin UI (Vite + Tailwind). Agents, SKUs, transactions, users.
    site/        ← Marketing site (Vite + Tailwind).
    aaf/
      whatsapp/  ← Cloudflare Worker. Receives Meta webhooks, forwards to gateway.
      telegram/  ← Same pattern, different channel.
      sms/       ← Africa's Talking SMS.

packages/
  types/         ← Shared TypeScript interfaces (env bindings, entities).
  utils/         ← generateId (ULID), slugify, now(), ok/err helpers.

docs/            ← Architecture docs. Read before designing new features.
```

---

## Absolute rules — never break these

1. Use pnpm. Never npm or yarn. Run `pnpm install` at repo root.
2. Turborepo orchestrates builds. Never run tsc/build inside individual packages manually.
3. One D1 database: `platform-db`. All workers share it via their own `[[d1_databases]]`
   binding in wrangler.toml. Schema lives in `apps/api/gateway/drizzle/`.
4. Drizzle ORM for all DB access. No raw SQL in TypeScript except migrations.
5. Hono for all Cloudflare Workers HTTP. No Express, no Fastify.
6. Pino for all logging. No console.log in production paths.
7. Never commit .dev.vars files. Secrets are managed via Doppler.
8. Business logic lives in `version_1.ts` blueprint. `machine.ts` is a pure executor —
   do not add business logic there.
9. All new sellable document types = new SKU record in the `skus` table. No code change.
10. Git: work in `feat/*`, merge to `dev`, merge to `main` for production.

---

## Architecture — how data flows

```
WhatsApp user sends message
        │
        ▼
aaf/whatsapp  (Cloudflare Worker)
  Verifies Meta signature
  Normalises phone: +254XXXXXXXXX
  POSTs to → gateway /api/v1/machine/advance
        │
        ▼
api/gateway  ConversationMachine
  Loads session from SESSIONS_KV
  Runs 4-stage state machine (see below)
  Calls AGENT_WORKER, DOCGEN_WORKER, PAYMENTS_WORKER via service bindings
  Persists session back to KV
  Returns { reply: string }
        │
        ▼
aaf/whatsapp sends reply via Meta Graph API
```

### The 4-stage machine (apps/api/gateway/src/machine/)

```
identify  →  auth  →  collect  →  farewell  →  closed
                         │
                    sku_select
                    collection
                    validation
                    transaction
                    transaction_validation
                    generation
                    repetition_or_close
```

Blueprint owns the flow: `src/machine/steps/business-logic/version_1.ts`
Machine executes it:    `src/machine/machine.ts`
States/types:           `src/machine/states/index.ts`

---

## Database

Single D1 database: `platform-db`

Migration file: `apps/api/gateway/drizzle/migration/0000_init.sql`
Schema types:   `apps/api/gateway/drizzle/schema/database.ts`

Tables and owners:

| Table          | Owner   | Purpose                                      |
|----------------|---------|----------------------------------------------|
| agents         | gateway | Agent config (slug, system prompt, model)    |
| users          | gateway | WhatsApp users identified by phone number    |
| conversations  | gateway | One session per user per agent               |
| messages       | gateway | All turns in every conversation              |
| documents      | docgen  | Generated file records (R2 URL)              |
| templates      | docgen  | Legacy template records (use skus instead)   |
| skus           | docgen  | Active sellable products (conversation flow) |
| transactions   | payments| M-Pesa STK push records                      |

SKU schema fields (skus table):

| Column              | Type    | What it stores                              |
|---------------------|---------|---------------------------------------------|
| id                  | TEXT    | ULID                                        |
| slug                | TEXT    | Unique URL key e.g. "professional-cv"       |
| agent_slug          | TEXT    | Which agent sells this SKU                  |
| price               | REAL    | KES amount (1-5 during e2e test)            |
| field_schema        | TEXT    | JSON: FieldSchema[] — form fields           |
| conversation_steps  | TEXT    | JSON: ConversationStep[] — machine steps    |
| is_active           | INTEGER | 0 = hidden, 1 = visible to users            |
| requires_review     | INTEGER | 1 = admin must approve after extraction     |

---

## Local dev setup

### Prerequisites

- Node 20+
- pnpm 9.x (`npm install -g pnpm@9.15.0`)
- Wrangler CLI (`pnpm add -g wrangler`)
- Doppler CLI (https://docs.doppler.com/docs/install-cli)
- ngrok (for WhatsApp webhook tunnelling)

### First-time setup

```bash
git clone https://github.com/devthinji/cloudflare-monorepo
cd cloudflare-monorepo
pnpm install

# Link Doppler (project: cloudflare-monorepo, config: dev)
doppler login
doppler setup
```

Add these secrets in the Doppler dashboard under config `dev`:

```
JWT_SECRET            (any 32+ char string for local dev)
OPENROUTER_API_KEY    (from openrouter.ai)
MPESA_CONSUMER_KEY    (Daraja sandbox)
MPESA_CONSUMER_SECRET (Daraja sandbox)
MPESA_PASSKEY         (Daraja sandbox)
MPESA_SHORTCODE       174379
MPESA_CALLBACK_URL    https://<your-ngrok-url>/api/v1/payments/mpesa/callback
MPESA_ENVIRONMENT     sandbox
WHATSAPP_TOKEN        (Meta access token)
WHATSAPP_VERIFY_TOKEN (any string — must match Meta dashboard)
WHATSAPP_PHONE_NUMBER_ID (from Meta Business Manager)
```

### Start all workers

```bash
pnpm dev
```

This script (scripts/dev-local.sh) will:
1. Kill any stale processes on dev ports
2. Inject Doppler secrets into each worker's .dev.vars
3. Run pre-flight validation
4. Apply D1 migrations locally (silent — re-runs are harmless)
5. Start: gateway (:8787), agent (:8790), docgen (:8791), whatsapp (:8793), dashboard (:5173)
6. Start Drizzle Studio at https://local.drizzle.studio
7. Wait for health checks, then print a summary table with **clickable health URLs** (OSC 8 hyperlinks)

Wrangler noise (banners, binding dumps, version warnings) is filtered out. Only ANSI-colored request logs and errors appear in the terminal.

### Seed the database

After the first `pnpm dev`, run once:

```bash
pnpm db:seed
```

This inserts:
- Taji agent config
- Elim agent config
- 3 active SKUs (Professional CV KES 1, Cover Letter KES 2, Resignation Letter KES 3)

### Expose WhatsApp webhook

```bash
ngrok http 8793
```

Set in Meta Business Manager:
- Webhook URL: https://<ngrok-id>.ngrok-free.app/webhook
- Verify Token: same as WHATSAPP_VERIFY_TOKEN in Doppler

---

## Current development status

Branch: `feat/e2e`
Stage: Ready for end-to-end WhatsApp testing

What works:
- ConversationMachine (4-stage, blueprint-driven)
- SKU loading + conversation step sequencing
- M-Pesa STK push initiation
- Payment callback handling
- Document record creation
- Dashboard: agents, SKUs, conversations, documents, users

What needs e2e test confirmation:
- Full WhatsApp → machine → M-Pesa → docgen → WhatsApp reply loop
- Payment callback reaches payments worker and updates transaction status
- Document generation triggers after payment confirmed
- File delivered to user via WhatsApp media message

Known gaps (post e2e, pre production):
- docxtemplater rendering not wired to SKU field_schema values
- No WhatsApp media message send for generated .docx
- Elim agent flow not built (Taji first)
- Dashboard SKU upload UI not connected to docgen /upload endpoint

---

## Key commands

```bash
pnpm dev                  # start all workers + dashboard
pnpm db:seed              # seed local D1 with agents + SKUs
pnpm db:seed:remote       # seed production D1
pnpm run type-check       # tsc --noEmit across all packages
pnpm run build            # build all packages
```

Per-worker (cd into the worker directory first):

```bash
npx wrangler dev          # start that worker only
npx wrangler d1 execute platform-db --local --command "SELECT * FROM skus"
npx wrangler tail         # stream live logs from deployed worker
```

---

## Adding a new SKU (no code change needed)

1. Upload a .docx template via dashboard or POST to /api/v1/docgen/skus/upload
2. The PipelineFactory extracts {placeholders} from the file
3. AI infers field labels, types, hints → stores in field_schema
4. ConversationStep list is auto-generated from field_schema
5. Set is_active = 1 in dashboard
6. SKU is immediately available to agents via listSKUs()

---

## Service bindings (local ports)

| Worker         | Port | Binding name in gateway    |
|----------------|------|----------------------------|
| api-gateway    | 8787 | (entry point)              |
| api-agent      | 8790 | AGENT_WORKER               |
| api-docgen     | 8791 | DOCGEN_WORKER              |
| api-payments   | 8792 | PAYMENTS_WORKER            |
| aaf-whatsapp   | 8793 | (calls gateway)            |
| dashboard      | 5173 | (standalone Vite app)      |

---

## File conventions

- All IDs: ULID via `generateId()` from `@repo/utils`
- All timestamps: ISO 8601 via `now()` from `@repo/utils`
- All DB operations: Drizzle ORM, never raw SQL in TS
- All errors: `ok(data)` / `err(message)` from `@repo/utils`
- All logs: `createLogger(env)` returns a Pino instance

---

## Collaboration protocol

This repo is worked on by two agents:
1. Clem (Base44 Superagent) — architecture, scaffolding, cross-cutting changes
2. Local dev (Opencode CLI) — feature implementation, testing, fixes

Workflow:
1. Clem pushes scaffolding/architecture to `feat/e2e`
2. Local dev pulls, implements feature, pushes back to `feat/e2e`
3. After e2e test passes: `feat/e2e` → PR → `dev` → PR → `main`
4. Never push directly to `main`

When local dev makes breaking changes to machine.ts, states, or the DB schema,
update the relevant section in this file before pushing.
