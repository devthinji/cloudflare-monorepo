# Local Dev Setup

## Prerequisites

- Node 20+
- pnpm 9.x (`npm install -g pnpm@9.15.0`)
- Wrangler CLI (`pnpm add -g wrangler`)
- ngrok (for WhatsApp webhook tunnelling)

## First-time setup

```bash
git clone https://github.com/devthinji/cloudflare-monorepo
cd cloudflare-monorepo
pnpm install

# Create .dev.vars files for local development
pnpm setup:dev
```

Open each `.dev.vars` and fill in real values:

| Worker | `.dev.vars` location | Required vars |
|---|---|---|
| gateway | `apps/api/gateway/.dev.vars` | `JWT_SECRET` |
| agent | `apps/api/agent/.dev.vars` | `OPENROUTER_API_KEY`, `JWT_SECRET`, `DB_ENCRYPTION_KEY` |
| docgen | `apps/api/docgen/.dev.vars` | `OPENROUTER_API_KEY` |
| payments | `apps/api/payments/.dev.vars` | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` |
| whatsapp | `apps/web/aaf/whatsapp/.dev.vars` | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| telegram | `apps/web/aaf/telegram/.dev.vars` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` |
| sms | `apps/web/aaf/sms/.dev.vars` | `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_SENDER_ID` |

## Start all workers

```bash
pnpm dev
```

This script (scripts/dev-local.sh) will:
1. Kill any stale processes on dev ports
3. Runs pre-flight validation
4. Apply D1 migrations locally
5. Start: gateway (:8787), agent (:8790), docgen (:8791), payments (:8792), whatsapp (:8793), dashboard (:5173)
6. Start Drizzle Studio at https://local.drizzle.studio

## Seed the database

After the first `pnpm dev`, run once:

```bash
pnpm db:seed
```

This inserts:
- Taji agent config
- Elim agent config
- 3 active SKUs (Professional CV KES 1, Cover Letter KES 2, Resignation Letter KES 3)

## Service bindings (local ports)

| Worker         | Port | Binding name in gateway    |
|----------------|------|----------------------------|
| api-gateway    | 8787 | (entry point)              |
| api-agent      | 8790 | AGENT_WORKER               |
| api-docgen     | 8791 | DOCGEN_WORKER              |
| api-payments   | 8792 | PAYMENTS_WORKER            |
| aaf-whatsapp   | 8793 | (calls gateway)            |
| dashboard      | 5173 | (standalone Vite app)      |

## Per-worker commands

```bash
cd apps/api/gateway && npx wrangler dev          # start that worker only
npx wrangler d1 execute platform-db --local --command "SELECT * FROM skus"
npx wrangler tail                                 # stream live logs from deployed worker
```

## Secrets management

Three silos:

| Source | What | Set by |
|---|---|---|
| `.dev.vars` per worker | Local-only secrets (JWT, M-Pesa, OpenRouter, WhatsApp) | You, first-time setup |
| Cloudflare Secrets | Production secrets (`wrangler secret put`) | CI/CD pipeline |
| D1 + Dashboard | Per-agent config (WhatsApp tokens, model, prompts) | Dashboard UI |

`.dev.vars` files are gitignored — never commit them.
