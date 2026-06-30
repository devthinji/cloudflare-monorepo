# Local Dev Setup

## Prerequisites

- Node 20+
- pnpm 9.x (`npm install -g pnpm@9.15.0`)
- Wrangler CLI (`pnpm add -g wrangler`)
- Doppler CLI (https://docs.doppler.com/docs/install-cli)
- ngrok (for WhatsApp webhook tunnelling)

## First-time setup

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

## Start all workers

```bash
pnpm dev
```

This script (scripts/dev-local.sh) will:
1. Kill any stale processes on dev ports
2. Inject Doppler secrets into each worker's .dev.vars
3. Run pre-flight validation
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

## Doppler secrets

All worker secrets are managed via Doppler. No .dev.vars files are committed.

```bash
doppler secrets download --no-file --format env > <worker>/.dev.vars
```

Each worker's wrangler dev picks up .dev.vars automatically. All .dev.vars files are gitignored.
