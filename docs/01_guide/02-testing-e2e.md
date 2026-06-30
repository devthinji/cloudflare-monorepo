# E2E WhatsApp Testing

## Goal

Confirm the full flow works end-to-end before setting real prices:

WhatsApp message → ConversationMachine → M-Pesa STK push → document generation → WhatsApp delivery

## Prerequisites

- Doppler CLI installed and linked (`doppler setup`)
- pnpm 9.x installed
- ngrok installed
- Meta WhatsApp Business test number configured
- Daraja sandbox credentials in Doppler

## Setup

### 1. Install and seed

```bash
pnpm install
pnpm dev
pnpm db:seed
```

### 2. Expose the WhatsApp AAF worker

```bash
ngrok http 8793
```

### 3. Configure Meta webhook

In Meta Business Manager → WhatsApp → Configuration:
- Webhook URL: https://<ngrok-id>.ngrok-free.app/webhook
- Verify Token: same as WHATSAPP_VERIFY_TOKEN in Doppler
- Subscribe to: messages

Update MPESA_CALLBACK_URL in Doppler to:
https://<ngrok-id>.ngrok-free.app/api/v1/payments/mpesa/callback

## Test flow

Send from a real WhatsApp number to the test number.

### Step 1 — Identify + Auth

Send: Hello → greeting + name request
Send: Jane Kamau → welcome + SKU menu (5 options — 2 free, 3 paid)

### Step 2 — SKU selection

Pick a *free* SKU first (e.g. "General Document (Free)" or "Basic CV (Free)"):
Send: 1 or 5 → first field prompt

### Step 3 — Field collection

Answer each prompt. Machine validates and moves to next step.
After last field: full summary + "Is this correct? Reply Yes to pay or No to edit."

### Step 4 — Payment (free SKU)

Send: Yes → "🎉 [SKU] is free! Generating your document now..."
No M-Pesa prompt — skips directly to generation.

### Step 5 — Document delivery

Expected: WhatsApp document message with generated .docx file (uploaded to Meta,
media ID obtained, sent as WhatsApp media document).

### Step 6 — Repeat or close

Expected: "Would you like another document? Reply Yes or No."

## Adding a new SKU with a .docx template

1. Create a .docx file with `{placeholder}` syntax in the text (e.g. `{doc_title}`, `{doc_body}`)
2. Place it in `public/docx/<name>.docx`
3. Upload via the docgen API:
   ```bash
   curl -s -X POST http://localhost:8791/api/v1/docgen/skus/upload \
     -F "file=@public/docx/<name>.docx" \
     -F "name=My SKU Name" \
     -F "agentSlug=taji" \
     -F "documentType=document" \
     -F "price=0"
   ```
4. The PipelineFactory unzips the .docx, extracts `{placeholder}` keys from `word/document.xml`, and the AI infers field labels/types
5. If the AI returns empty `fieldSchema`, patch it manually:
   ```bash
   curl -s -X PATCH "http://localhost:8791/api/v1/docgen/skus/<id>" \
     -H "Content-Type: application/json" \
     -d '{"isActive":true,"fieldSchema":[{"key":"doc_title","label":"Title?","type":"text","required":true,"order":1}],"agentAccess":[{"agentSlug":"taji","enabled":true}]}'
   ```
6. The SKU is immediately available to users

## Debugging

```bash
# View session in KV
npx wrangler kv key get --binding=SESSIONS_KV "session:<phone>" \
  --config=apps/api/gateway/wrangler.toml --local

# Check D1 records
npx wrangler d1 execute platform-db --local \
  --command="SELECT * FROM customers" \
  --config=apps/api/gateway/wrangler.toml

# Reset session
# Send /reset to WhatsApp or delete the KV key directly

# Live logs
cd apps/api/gateway  && npx wrangler tail --local
cd apps/api/agent    && npx wrangler tail --local
cd apps/api/payments && npx wrangler tail --local
```

## Known gaps (do not block test)

- No retry flow if M-Pesa STK times out
