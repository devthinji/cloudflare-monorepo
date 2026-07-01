# AGENTS.md — api/payments

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this worker.

## Purpose

Handles all M-Pesa Daraja STK push flows. Initiates payment requests, receives
Safaricom callbacks, updates transaction status, and notifies the agent worker
when payment is confirmed so document generation can proceed.

## Worker name / local port

`api-payments` — port 8792

## Bindings

| Binding        | Type    | What it is                                         |
|----------------|---------|----------------------------------------------------|
| DB             | D1      | platform-db (transactions table)                   |
| PAYMENTS_KV    | KV      | In-flight STK state: checkoutRequestId → txId      |
| AGENT_WORKER   | Service | api-agent (notify on payment completion)           |

## Routes

```
GET  /health

POST /api/v1/payments/mpesa/stk                         — initiate STK push
GET  /api/v1/payments/mpesa/stk/:checkoutRequestId      — query STK status

POST /webhooks/mpesa                                    — Safaricom callback (public)

GET  /api/v1/payments/transactions/:userId              — list transactions for user
POST /api/v1/payments/notify-agent                      — internal: trigger agent after payment
```

## M-Pesa STK push flow

```
Gateway → POST /api/v1/payments/mpesa/stk
          body: { phone, amount, skuId, userId, description }
    │
    ▼
Daraja OAuth → access token (cached in PAYMENTS_KV, TTL 55 min)
    │
    ▼
Daraja STK Push → CheckoutRequestID
    │
    ▼
D1: INSERT transaction (status: pending)
KV: set checkoutRequestId → transactionId
    │
    ▼
Return { checkoutRequestId }
    │
    ▼ (user enters PIN on phone)
    │
Safaricom → POST /webhooks/mpesa
    │
    ▼
KV lookup checkoutRequestId → transactionId
D1: UPDATE transaction (status: completed, mpesaReceiptNumber)
    │
    ▼
AGENT_WORKER.fetch POST /api/v1/payments/notify-agent
  body: { transactionId, userId, skuId }
    │
    ▼
Agent triggers document generation
```

## Daraja sandbox

Shortcode: 174379
Test phone: any registered Safaricom number (sandbox does not send real PIN prompts).
Simulate callback via Daraja test portal: https://developer.safaricom.co.ke/test_credentials

## Callback URL for local dev

The callback must be a public HTTPS URL. Expose the payments worker directly:
```bash
ngrok http 8792
```
Set in `.dev.vars`:
```
MPESA_CALLBACK_URL=https://<ngrok-id>.ngrok-free.app/webhooks/mpesa
```

## Required secrets (Cloudflare Secrets)

All six are set via `wrangler secret put` for production, and in `.dev.vars` for local dev.

```
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_SHORTCODE       174379 (sandbox)
MPESA_CALLBACK_URL    public HTTPS URL
MPESA_ENVIRONMENT     sandbox | production
```

## Key files

```
src/
  index.ts
  routes/index.ts
  controllers/
    mpesa.ts           — STK push initiation + status query
    webhooks.ts        — Safaricom callback handler
    transactions.ts    — list + notify-agent
  lib/
    daraja.ts          — Daraja OAuth + STK Push API client
    logger.ts
```

## Rules

- Always return 200 from /webhooks/mpesa — Safaricom retries on 5xx
- Check transaction status before updating — idempotent callback handling
- Never hardcode Daraja URLs — use MPESA_ENVIRONMENT to switch endpoints
- Never store Daraja access tokens in D1 — KV with short TTL only
