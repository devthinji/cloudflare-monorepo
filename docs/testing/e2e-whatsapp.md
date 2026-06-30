# E2E WhatsApp Test — Local Setup & Checklist

## Goal

Confirm the full flow works end-to-end before setting real prices:

WhatsApp message → ConversationMachine → M-Pesa STK push → document generation → WhatsApp delivery

---

## Prerequisites

- Doppler CLI installed and linked (`doppler setup`)
- pnpm 9.x installed
- ngrok installed
- Meta WhatsApp Business test number configured
- Daraja sandbox credentials in Doppler

---

## Setup steps

### 1. Install and seed

```bash
pnpm install
pnpm dev        # starts all 5 workers + dashboard
pnpm db:seed    # inserts Taji + Elim agents + 3 SKUs (run once)
```

### 2. Expose the WhatsApp AAF worker

```bash
ngrok http 8793
```

Copy the https URL (e.g. https://abc123.ngrok-free.app)

### 3. Configure Meta webhook

In Meta Business Manager → WhatsApp → Configuration:
- Webhook URL: https://abc123.ngrok-free.app/webhook
- Verify Token: (same as WHATSAPP_VERIFY_TOKEN in Doppler)
- Subscribe to: messages

Update MPESA_CALLBACK_URL in Doppler to:
https://abc123.ngrok-free.app/api/v1/payments/mpesa/callback

---

## Service ports

| Worker       | Port |
|--------------|------|
| api-gateway  | 8787 |
| api-agent    | 8790 |
| api-docgen   | 8791 |
| aaf-whatsapp | 8793 |
| dashboard    | 5173 |

Dashboard: http://localhost:5173
Drizzle Studio: https://local.drizzle.studio

---

## Test flow

Send from a real WhatsApp number to the test number.

### Step 1 — Identify + Auth

Send: Hello

Expected: greeting + name request

Send: Jane Kamau

Expected: welcome + SKU menu:
  1. Professional CV — KES 1
  2. Application / Cover Letter — KES 2
  3. Resignation Letter — KES 3

### Step 2 — SKU selection

Send: 1

Expected: first field prompt
  1/10 — Full Name
  Your full legal name

### Step 3 — Field collection

Answer each prompt in sequence. The machine validates and moves to the next step.

After the last field:

Expected: full summary + "Is this correct? Reply Yes to pay or No to edit."

### Step 4 — Payment

Send: Yes

Expected: "Sending M-Pesa request to 07XXXXXXXX..."
Then on phone: M-Pesa STK push notification

Enter PIN on phone.

Expected on WhatsApp: "Payment confirmed! Generating your CV..."

### Step 5 — Document delivery

Expected: WhatsApp document message with the generated .docx file

### Step 6 — Repeat or close

Expected: "Would you like another document? Reply Yes or No."

---

## Debugging

### Check machine session state

```bash
# Gateway KV — view session
npx wrangler kv key get --binding=SESSIONS_KV "session:<phone>" \
  --config=apps/api/gateway/wrangler.toml --local
```

### Check D1 records

```bash
# Users
npx wrangler d1 execute platform-db --local \
  --command="SELECT * FROM users" \
  --config=apps/api/gateway/wrangler.toml

# Transactions
npx wrangler d1 execute platform-db --local \
  --command="SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5" \
  --config=apps/api/gateway/wrangler.toml

# Documents
npx wrangler d1 execute platform-db --local \
  --command="SELECT * FROM documents ORDER BY created_at DESC LIMIT 5" \
  --config=apps/api/gateway/wrangler.toml
```

### Reset a session (start over without restarting workers)

Send to WhatsApp: /reset

Or delete the KV key directly in Drizzle Studio / wrangler.

### Live worker logs

```bash
# In separate terminals
cd apps/api/gateway  && npx wrangler tail --local
cd apps/api/agent    && npx wrangler tail --local
cd apps/api/payments && npx wrangler tail --local
```

---

## Known gaps (do not block test, fix after)

- docxtemplater fill not yet wired to collected field values (doc renders empty template)
- WhatsApp media message send not yet implemented (doc URL returned as text link)
- No retry flow if M-Pesa STK times out

---

## Pass criteria

The e2e test passes when:
1. A real WhatsApp number completes the full flow above
2. A transaction record appears in the dashboard with status "completed"
3. A document record appears with a valid R2 file URL
4. The user receives the file on WhatsApp

Once passed: update prices in dashboard and open PR from feat/e2e → dev.
