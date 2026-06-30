# Doppler Secrets Setup

All worker secrets are managed via Doppler. No .dev.vars files are committed.

## First-time setup

1. Install Doppler CLI
   https://docs.doppler.com/docs/install-cli

2. Login
   doppler login

3. Create the project on doppler.com
   Project name: cloudflare-monorepo
   Environments: dev, stg, prd

4. Link your local repo
   doppler setup
   (select project: cloudflare-monorepo, config: dev)

5. Add secrets in the Doppler dashboard

## Required secrets by config

### dev (local testing)

*Shared*
JWT_SECRET
OPENROUTER_API_KEY

*M-Pesa (Daraja sandbox)*
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://<ngrok-url>/webhooks/mpesa
MPESA_ENVIRONMENT=sandbox

*WhatsApp*
WHATSAPP_TOKEN
WHATSAPP_VERIFY_TOKEN
WHATSAPP_PHONE_NUMBER_ID

### stg / prd

Same keys. MPESA_ENVIRONMENT=production. Real Daraja credentials.

## How secrets are injected

pnpm dev calls:
  doppler run -- bash scripts/dev-local.sh

dev-local.sh runs:
  doppler secrets download --no-file --format env > <worker>/.dev.vars

Each worker's wrangler dev picks up .dev.vars automatically.
All .dev.vars files are gitignored.

## Verify your setup

doppler secrets
