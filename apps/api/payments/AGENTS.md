# AGENTS.md — api/payments

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this worker.

## Purpose

Handles all M-Pesa Daraja STK push flows. Initiates payment requests, receives
Safaricom callbacks, updates transaction status, and notifies the agent worker
when payment is confirmed so document generation can proceed.

## Cloudflare worker name

`api-payments`  — local port 8792

## Bindings

| Binding      | Type    | What it is                                      |
|--------------|---------|--------------------------------------------------|
| DB           | D1      | platform-db (reads/writes transactions table)    |
| PAYMENTS_KV  | KV      | In-flight STK push state (checkoutRequestId → tx)|
| AGENT_WORKER | Service | api-agent (notify on payment completion)         |

## Routes

```
GET  /health

POST /api/v1/payments/mpesa/stk                       — initiate STK push
GET  /api/v1/payments/mpesa/stk/:checkoutRequestId    — query STK push status

POST /webhooks/mpesa                                  — Safaricom callback (public, no JWT)

GET  /api/v1/payments/transactions/:userId            — list transactions for user
POST /api/v1/payments/notify-agent                    — internal: trigger agent after payment
```

## M-Pesa STK push flow

```
1. Gateway calls POST /api/v1/payments/mpesa/stk
   Body: { phone, amount, skuId, userId, description }

2. payments worker calls Daraja OAuth → gets access token
3. Calls Daraja STK Push API → gets CheckoutRequestID
4. Stores transaction record in D1 (status: pending)
5. Stores CheckoutRequestID → transactionId in PAYMENTS_KV
6. Returns { checkoutRequestId, message: "STK push sent" }

7. User enters M-Pesa PIN on phone

8. Safaricom sends callback to POST /webhooks/mpesa
9. Worker looks up CheckoutRequestID in PAYMENTS_KV
10. Updates transaction in D1 (status: completed, mpesaReceiptNumber)
11. Calls AGENT_WORKER.fetch POST /api/v1/payments/notify-agent
    Body: { transactionId, userId, skuId }
12. Agent worker triggers document generation
```

## Daraja sandbox

Shortcode: 174379
Test STK push: any amount, any 07XXXXXXXX Safaricom number.
The sandbox does not send a real PIN prompt — use the Daraja test tool
at https://developer.safaricom.co.ke/test_credentials to simulate callback.

## MPESA_CALLBACK_URL

Must be a publicly reachable HTTPS URL. For local dev use ngrok:
```bash
ngrok http 8793   # WhatsApp AAF port
```
Then set in Doppler:
```
MPESA_CALLBACK_URL=https://<ngrok-id>.ngrok-free.app/webhooks/mpesa
```

Note: The callback URL must point to the worker that handles /webhooks/mpesa.
In local dev this is the payments worker on port 8792, but ngrok tunnels port 8793
(whatsapp AAF). Route /webhooks/mpesa through the gateway or expose payments worker
directly with a second ngrok tunnel.

## Required secrets (via Doppler)

```
MPESA_CONSUMER_KEY       — Daraja app consumer key
MPESA_CONSUMER_SECRET    — Daraja app consumer secret
MPESA_PASSKEY            — Daraja lipa na mpesa passkey
MPESA_SHORTCODE          174379 (sandbox) / live shortcode (prod)
MPESA_CALLBACK_URL       — public HTTPS URL for Safaricom callback
MPESA_ENVIRONMENT        sandbox | production
```

## Key files

```
src/
  index.ts                  — entry point
  routes/index.ts           — all route definitions
  controllers/
    mpesa.ts                — STK push initiation + query
    webhooks.ts             — Safaricom callback handler
    transactions.ts         — transaction list + notify-agent
  lib/
    daraja.ts               — Daraja OAuth + STK push API client
    logger.ts               — Pino logger
```

## What NOT to do

- Do not validate Safaricom callback signature in a way that blocks retries —
  Safaricom will retry on 5xx, so always return 200 from /webhooks/mpesa
- Do not process a callback twice — check transaction status before updating
- Do not hardcode Daraja URLs — use MPESA_ENVIRONMENT to switch sandbox/production
- Do not store access tokens in D1 — use PAYMENTS_KV with a short TTL
