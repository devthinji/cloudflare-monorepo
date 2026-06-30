# Staging Plan — Build Phases

## Principle

Ship the smallest thing that proves the idea. Then add one layer at a time.
We start with Taji. We do not build Elim until Taji works end-to-end.

## Phase 0 — Foundation ✅ Complete

Monorepo, workers, dashboard scaffolded and pushed to GitHub.

- [x] pnpm + Turborepo monorepo
- [x] Gateway Worker (Hono, JWT, ConversationMachine)
- [x] Agent Worker (TajiAgent, ElimAgent as Durable Objects)
- [x] Docgen Worker (PipelineFactory, SKU CRUD, R2)
- [x] Payments Worker (M-Pesa Daraja STK push + callback)
- [x] WhatsApp AAF Worker (Meta webhook, phone normalisation)
- [x] React dashboard (agents, SKUs, conversations, documents, users, transactions)
- [x] D1 schema + migrations (all 8 tables)
- [x] Dev seed: Taji + Elim agents, 3 Taji SKUs at test prices
- [x] Doppler secrets management
- [x] Pre-flight tsc checks clean

Branch: `feat/e2e`

## Phase 1 — End-to-End WhatsApp Test 🔨 Current

Goal: A real user WhatsApps Taji, pays KES 1–3 via M-Pesa, and receives a document.

### Setup
```
doppler login && doppler setup
pnpm install && pnpm dev && pnpm db:seed
ngrok http 8793
```

### Test checklist
- [ ] WhatsApp message arrives at aaf/whatsapp, forwarded to gateway
- [ ] ConversationMachine identifies new user, runs auth (name collection)
- [ ] SKU menu displayed (Professional CV KES 1, Cover Letter KES 2, Resignation Letter KES 3)
- [ ] User picks SKU, machine runs conversation_steps collection
- [ ] All fields collected, summary sent to user
- [ ] User confirms → M-Pesa STK push fires
- [ ] User enters PIN → callback received → transaction complete
- [ ] Docgen triggered → docxtemplater fills template → file stored in R2
- [ ] WhatsApp document delivered to user
- [ ] Dashboard shows conversation, transaction, document record

### Gaps to close before production
- [ ] Wire docxtemplater to field_schema values from SKU
- [ ] Send WhatsApp media message after generation
- [ ] Handle M-Pesa timeout gracefully (allow retry)
- [ ] Returning user: skip auth, go straight to SKU menu with prefilled fields

## Phase 2 — Taji Hardening 🔒 Post e2e

- [ ] Real pricing set in dashboard
- [ ] Returning user: prefill fields from previous document
- [ ] Bilingual: Swahili detection + response
- [ ] Rate limiting per phone number (KV-based)
- [ ] Error recovery: AI timeout, docgen fail, payment fail
- [ ] /reset and /help commands
- [ ] Dashboard analytics: documents per day, revenue

## Phase 3 — Elim MVP 📚 Post Taji

- [ ] Elim agent blueprint (version_1.ts for Elim)
- [ ] CBC subject + strand awareness in system prompt
- [ ] Student session tracking (student_sessions table)
- [ ] Practice question flow
- [ ] Score + weak area logging
- [ ] Teacher flow: exam generation → .docx → WhatsApp

## Phase 4 — Platform Features 🌍

- [ ] Telegram channel (aaf/telegram worker)
- [ ] SMS channel (aaf/sms, Africa's Talking)
- [ ] Dashboard: full SKU Studio (upload → extract → price → activate)
- [ ] Public website live (apps/web/site)
- [ ] Multi-tenancy: schools as tenants for Elim

## Git workflow

```
feat/*   ← active development (Clem + local dev)
  ↓ PR
dev      ← integration testing
  ↓ PR + sign-off
main     ← production (Cloudflare auto-deploy)
```

## Cloudflare resource usage (free tier)

| Resource | Free limit     | Current usage      |
|----------|----------------|--------------------|
| Workers  | 100k req/day   | 5 workers deployed |
| D1       | 5M rows/day    | 1 database         |
| KV       | 100k reads/day | 2 namespaces       |
| R2       | 10GB storage   | 1 bucket           |
| Pages    | Unlimited      | 2 sites            |
