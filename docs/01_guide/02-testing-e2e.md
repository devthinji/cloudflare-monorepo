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
Send: Jane Kamau → welcome + SKU menu (1. Professional CV KES 1, 2. Cover Letter KES 2, 3. Resignation Letter KES 3)

### Step 2 — SKU selection

Send: 1 → first field prompt (1/10 — Full Name)

### Step 3 — Field collection

Answer each prompt. Machine validates and moves to next step.
After last field: full summary + "Is this correct? Reply Yes to pay or No to edit."

### Step 4 — Payment

Send: Yes → "Sending M-Pesa request to 07XXXXXXXX..."
Enter PIN on phone → "Payment confirmed! Generating your CV..."

### Step 5 — Document delivery

Expected: WhatsApp document message with generated .docx file

### Step 6 — Repeat or close

Expected: "Would you like another document? Reply Yes or No."

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

- docxtemplater fill not yet wired to collected field values (renders empty template)
- WhatsApp media message send not yet implemented (doc URL returned as text link)
- No retry flow if M-Pesa STK times out
