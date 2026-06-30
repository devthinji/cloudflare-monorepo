# AGENTS.md — aaf/whatsapp

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this worker.

## Purpose

Receives incoming WhatsApp messages from Meta's webhook, validates the signature,
normalises the phone number, and forwards the message to the gateway
ConversationMachine. Sends the machine's reply back to the user via the Meta Graph API.
This worker is the only one exposed to the public internet on the WhatsApp side.

## Cloudflare worker name

`aaf-whatsapp`  — local port 8793

## Bindings

| Binding    | Type    | What it is                               |
|------------|---------|-------------------------------------------|
| AAF_KV     | KV      | Deduplication cache (message IDs)         |
| API_GATEWAY| Service | api-gateway (ConversationMachine)         |

## Routes

```
GET  /health
GET  /webhook    — Meta webhook verification (challenge handshake)
POST /webhook    — incoming WhatsApp messages from Meta
```

## Webhook verification (GET)

Meta sends a GET with:
- hub.mode = "subscribe"
- hub.challenge = random string
- hub.verify_token = your WHATSAPP_VERIFY_TOKEN

Worker checks verify_token matches env var, then echoes hub.challenge as plain text.
Must return 200 with the challenge value for Meta to activate the webhook.

## Incoming message flow (POST)

```
1. Receive POST from Meta
2. Verify X-Hub-Signature-256 header (HMAC-SHA256 of body with WHATSAPP_APP_SECRET — Meta App Secret)
3. Parse body → extract: waMessageId, from (phone), text.body, phoneNumberId (metadata)
4. Route to agent via PHONE_NUMBER_ID_TO_AGENT map in config/phone-agent-map.ts:
     1038436689362682 → taji
     729899760214979  → elim
     122108114672001278 → test
5. Deduplicate: check AAF_KV for waMessageId (Meta sometimes sends duplicates)
6. Normalise phone: strip leading 0 → prefix +254 if Kenyan local format
   Examples:
     0712345678  → +254712345678
     254712345678 → +254712345678
     +254712345678 → unchanged
8. POST to API_GATEWAY: /api/v1/machine/advance
   Body: { phone, message, channel: "whatsapp" }
9. Receive { reply, interactive? } from gateway
10. If `interactive` is present: render buttons/list via `sendInteractiveMessage()`
    Instead of plain text. Uses `buildButtonMessage`/`buildListMessage` builders.
    Interactive types: `button` (up to 3 reply buttons) or `list` (single-select rows).
11. If no interactive: POST plain text reply to Meta Graph API:
    https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>/messages
    Body: { messaging_product, to: phone, type: "text", text: { body: reply } }
12. Incoming interactive replies (button_reply / list_reply) are handled by
    `parseIncomingMessage()` which extracts the button/list item `id` as the
    text forwarded to the gateway. IDs must match guard regexes in version_1.ts.
```

## Phone number normalisation rule

All phone numbers stored in D1 must be in E.164 format: +254XXXXXXXXX

```typescript
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    return '+254' + digits.slice(1)
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return '+' + digits
  }
  return '+' + digits  // assume already correct
}
```

## Required secrets (via Doppler)

```
WHATSAPP_ACCESS_TOKEN     — Meta permanent access token (from Meta Business Manager)
WHATSAPP_APP_SECRET       — Meta App Secret (from Meta Developer Portal → App Settings → Basic)
WHATSAPP_VERIFY_TOKEN     — any string, must match Meta webhook config
WHATSAPP_PHONE_NUMBER_ID  — default phone number ID (env fallback for /send)
```

## Meta webhook setup

1. Go to Meta Business Manager → WhatsApp → Configuration
2. Callback URL: https://<ngrok-id>.ngrok-free.app/webhook
3. Verify Token: same as WHATSAPP_VERIFY_TOKEN
4. Subscribe to: messages

For production: use the deployed worker URL instead of ngrok.

## Document delivery pipeline

When the gateway advance response includes a `document` field (after generation), the
WhatsApp worker triggers the delivery pipeline before sending the reply text.

```
message.ts handleWebhook()
  → machineModel.advance() → gets { reply, document, interactive? }
  → if pendingReset: handle exit confirmation flow (Yes/Cancel buttons)
  → if exit/quit/reset cmd: set pendingReset flag, send confirm buttons
  → if document: pipelines.deliverDocument()
      → GET buffer from docgen via API_GATEWAY proxy (api/v1/docgen/download?key=...)
      → POST to graph/v20.0/{{phone-id}}/media  →  media_id
      → POST to graph/v20.0/{{phone-id}}/messages → document: { id: media_id }
      → Retries 3x with exponential backoff on failure
  → sendReply() with text or interactive message
```

## Key files

```
src/
  index.ts            — app setup
  routes/index.ts     — GET + POST /webhook
  controllers/
    incoming/
      verify.ts       — webhook verification (GET)
      message.ts      — incoming message handler (POST) — wires delivery pipeline
      health.ts       — health check
    outgoing/
      reply.ts        — send reply messages via Meta API
  pipelines/
    index.ts          — delivery orchestrator (retry, error handling, buffer fetch)
    whatsapp-media.ts — upload buffer to Meta + send as media message
  lib/
    whatsapp.ts       — Meta Graph API client + payload types
    logger.ts         — Pino logger
  types/
    env.ts            — Env binding types
```

## What NOT to do

- Do not process any business logic here — forward to gateway and return the reply
- Do not skip signature verification — blocks spoofed webhook calls
- Do not change phone format before forwarding — normalise then forward consistently
- Do not send messages to users directly except as the reply to the gateway response
  (document delivery messages flow through the delivery pipeline in this worker)
