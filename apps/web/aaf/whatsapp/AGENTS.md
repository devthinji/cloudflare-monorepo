# AGENTS.md — aaf/whatsapp

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this worker.

## Purpose

Receives incoming WhatsApp messages from Meta webhooks, validates the signature,
normalises the phone number, maps the phone number ID to the correct agent, and
forwards to the gateway ConversationMachine. Handles interactive message replies
(button clicks, list selections). Delivers generated documents as WhatsApp media.

## Worker name / local port

`aaf-whatsapp` — port 8793

## Bindings

| Binding         | Type    | What it is                                |
|-----------------|---------|-------------------------------------------|
| DB              | D1      | platform-db (read agent credentials)      |
| DB_ENCRYPTION_KEY| Secret | AES-256-GCM key for decrypting apiKeys    |
| AAF_KV          | KV      | Session: agentSlug + pendingReset flag    |
| API_GATEWAY     | Service | api-gateway ConversationMachine           |

## Routes

```
GET  /health
GET  /webhooks/whatsapp    — Meta webhook verification (challenge)
POST /webhooks/whatsapp    — incoming messages + interactive replies
```

## Incoming message flow

```
1. Receive POST from Meta
2. Verify X-Hub-Signature-256 (HMAC-SHA256 with WHATSAPP_APP_SECRET)
3. Parse WaWebhookPayload
4. If status update (delivered/read) → log and return 200
5. Parse message: extract from (phone), text, phoneNumberId, name, messageId, type
6. Map phoneNumberId → agentSlug via PHONE_NUMBER_ID_TO_AGENT config
7. Load session from AAF_KV → get agentSlug, pendingReset
8. Handle commands: /help, /reset, exit, quit
9. Handle pendingReset confirmation flow (buttons: confirm_reset / cancel_reset)
10. POST to API_GATEWAY: /api/v1/machine/advance
    Body: { phone, message, agentSlug, channel: "whatsapp" }
11. Read response: { reply, document?, interactive? }
12. If document → deliverDocument() pipeline (upload media → send document message)
13. If interactive hint → sendInteractiveMessage() (buttons or list)
14. If reply text → sendReply() (chunked if > 4000 chars)
15. Return 200 to Meta
```

## Phone number normalisation

All phones stored in D1 and used as session keys must be E.164: `+254XXXXXXXXX`

Rule applied in `src/lib/whatsapp.ts`:
```typescript
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10)
    return '+254' + digits.slice(1)
  if (digits.startsWith('254') && digits.length === 12)
    return '+' + digits
  return '+' + digits
}
```

## Phone number ID → agent mapping (DB-driven)

The old `src/config/phone-agent-map.ts` has been replaced by `src/lib/agent-credentials.ts`.

At runtime, `resolveAgentCredentials()` queries D1 for all active agents, decrypts
their `channelConfig`, and matches the incoming `phoneNumberId` against
`whatsappPhoneNumberId`. This returns the agent's slug, access token, app secret,
and verify token — all stored encrypted in the `agents` table.

New agents are registered via the dashboard (no code change). Credentials are
seeded via `POST /api/v1/agent/agents/seed-credentials` (encrypted with
`DB_ENCRYPTION_KEY`).

## Interactive messages

The machine can return an `InteractionHint` with the reply.
This worker reads it and sends a WhatsApp interactive message:

- `type: 'buttons'` → up to 3 quick-reply buttons (24 char title limit)
- `type: 'list'` → scrollable list with sections (requires `buttonLabel`)

Used for: SKU selection menu, Yes/No confirmations, reset confirmation.

Interactive button/list replies come back as text (the button id) in the next webhook —
the machine and normalisation handle these the same as regular text input.

## Document delivery pipeline

File: `src/pipelines/index.ts` + `src/pipelines/whatsapp-media.ts`

When the machine returns a `document` in the response:
1. `fetchDocBuffer()` — fetch rendered .docx bytes from API_GATEWAY
   → `GET https://internal/api/v1/docgen/download?key=<r2-key>`
2. `uploadMedia()` — POST bytes to Meta Graph API media upload endpoint
3. `sendDocumentMedia()` — send document message with mediaId to user
4. Retries: 3 attempts with 2s, 4s, 6s backoff

## Reset / exit flow

Commands that trigger reset: `/reset`, `exit`, `quit`

Flow:
1. Set `session.pendingReset = true`, save to AAF_KV
2. Send interactive buttons: "Yes, reset" / "Cancel"
3. On next message:
   - `confirm_reset` / yes / ndio / sawa → reset machine, send confirmation
   - `cancel_reset` / no / cancel / back → clear pendingReset, continue
   - Anything else → re-show confirmation buttons

## Required secrets

```
DB_ENCRYPTION_KEY  — AES-256-GCM key (64 hex chars) for decrypting agent credentials from D1
```

WhatsApp credentials (access tokens, app secrets, verify tokens) are stored in D1 per agent,
encrypted at rest with DB_ENCRYPTION_KEY. See root AGENTS.md → "Seed agent credentials" 
for how to set them up locally.

## Meta webhook setup

1. Meta Business Manager → WhatsApp → Configuration
2. Callback URL: https://<ngrok-id>.ngrok-free.app/webhooks/whatsapp
3. Verify Token: any agent's verifyToken (from D1 `agents.api_keys.whatsappVerifyToken`)
4. Subscribe to: messages

## Key files

```
src/
  index.ts
  routes/index.ts
  config/
    phone-agent-map.ts           — phoneNumberId → agentSlug map
  types/
    env.ts                       — Env bindings, Session type, DEFAULT_AGENT
    interactive.ts               — full WhatsApp Cloud API v20.0 type definitions
    interactive.md               — human-readable reference for interactive types
  controllers/
    incoming/
      message.ts                 — main webhook handler (all logic lives here)
      verify.ts                  — GET challenge handler
      health.ts
    outgoing/
      reply.ts                   — sendReply, sendInteractiveMessage, sendHelp, sendReset, sendError
      send.ts                    — low-level message send helpers
  lib/
    whatsapp.ts                  — Meta Graph API client (send text, upload media, mark read)
    logger.ts
  models/
    machine.ts                   — MachineModel (calls gateway /machine/advance)
    session.ts                   — SessionModel (AAF_KV get/set)
  pipelines/
    index.ts                     — deliverDocument() with retry
    whatsapp-media.ts            — uploadMedia(), sendDocumentMedia()
  views/
    whatsapp.ts                  — message formatting helpers
```

## Rules

- No business logic here — forward to gateway, return the reply
- Never skip signature verification — it blocks spoofed requests
- Always normalise phone to E.164 before forwarding to gateway
- Always return 200 to Meta — even on errors (log them, don't fail the webhook)
- Document delivery is fire-and-forget after reply is sent
