# M-Pesa Daraja API — Payment Integration

## Overview

M-Pesa via Safaricom's **Daraja API** is the primary payment method for both Taji and Elim. All transactions — premium CV generation, school subscriptions, student top-ups — go through M-Pesa first.

> User has live Daraja credentials. This is a real, production-grade integration from day one.

---

## Daraja API Flows Used

### 1. STK Push (Lipa Na M-Pesa Online) — Primary
The most common flow. We send a payment prompt directly to the user's phone. They enter their M-Pesa PIN. Done.

```
Platform → Daraja API → Safaricom → User's phone (STK prompt)
User enters PIN → Safaricom → Daraja callback → Our callback Worker
```

**Use cases:**
- Taji: User wants to unlock premium CV / unlimited docs
- Elim: School pays monthly subscription
- Elim: Parent tops up student tutorship credits

### 2. C2B (Customer to Business) — Secondary
For cases where the user initiates the payment themselves (e.g. Paybill number).

### 3. B2C (Business to Customer) — Roadmap
For refunds or payouts. Not needed at launch.

---

## Credentials (Store as Encrypted Secrets in Agent Config)

```
MPESA_CONSUMER_KEY        → Daraja app consumer key
MPESA_CONSUMER_SECRET     → Daraja app consumer secret
MPESA_SHORTCODE           → Business shortcode (Paybill or Till)
MPESA_PASSKEY             → Lipa Na M-Pesa passkey
MPESA_CALLBACK_URL        → Your Worker endpoint for callbacks
MPESA_ENVIRONMENT         → "production" (live credentials ready)
```

These are stored in the `agents` table under `api_keys` (encrypted JSON) and loaded into the Channel Worker at runtime. They are **never** in code or wrangler.toml.

---

## Worker Design

### Transactions Worker (New — Phase 5)

A dedicated Hono worker for all payment operations, called via service binding.

```
Channel Worker
    │  "User wants to pay for premium"
    ▼
Gateway → Transactions Worker (binding: TRANSACTIONS)
    │
    ├── POST /stk-push      → Initiate STK push
    ├── POST /callback      → Receive Safaricom callback (public endpoint)
    ├── GET  /status/:id    → Check transaction status
    └── POST /confirm       → Confirm and unlock feature
```

### STK Push Flow

```typescript
// 1. Get OAuth token from Daraja
async function getDarajaToken(): Promise<string> {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}` } }
  )
  const { access_token } = await res.json()
  return access_token
}

// 2. Initiate STK Push
async function initiateSTKPush(phone: string, amount: number, reference: string) {
  const token = await getDarajaToken()
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)

  return fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,           // Customer phone: 2547XXXXXXXX
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: reference,
      TransactionDesc: 'Taji Premium',
    }),
  })
}
```

### Callback Handler

```typescript
// Safaricom calls this after payment
app.post('/callback', async (c) => {
  const body = await c.req.json()
  const { Body: { stkCallback } } = body

  if (stkCallback.ResultCode === 0) {
    // Payment successful
    const amount = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value
    const mpesaCode = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber').Value
    const phone = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber').Value

    // Save to transactions table in D1
    await saveTransaction({ phone, amount, mpesaCode, status: 'success' })

    // Unlock feature for user via Data Worker
    await unlockPremium(phone)

    // Notify user via Channel Worker → WhatsApp
    await notifyUser(phone, `✅ Malipo ya KES ${amount} yamepokewa. Mpesa: ${mpesaCode}. Asante!`)
  } else {
    // Payment failed/cancelled
    await notifyUser(phone, `❌ Malipo hayakufanikiwa. Jaribu tena.`)
  }

  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})
```

---

## Database — Transactions Table

```sql
CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,          -- ulid
  user_id         TEXT NOT NULL REFERENCES users(id),
  agent_slug      TEXT NOT NULL,
  phone           TEXT NOT NULL,             -- 2547XXXXXXXX
  amount          INTEGER NOT NULL,          -- KES
  mpesa_code      TEXT,                      -- e.g. QJK3XY7Z9P
  checkout_request_id TEXT,                 -- from STK push response
  merchant_request_id TEXT,
  purpose         TEXT NOT NULL,             -- "premium_cv" | "elim_credits" | "subscription"
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed | cancelled
  metadata        TEXT,                      -- JSON: any extra context
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

---

## WhatsApp Payment Conversation Flow

### Taji — Premium Unlock
```
User:  "Nataka premium"
Taji:  "Premium inakupa CV unlimited na templates za pro.
        Bei: KES 99/mwezi au KES 499/mwaka.
        Unataka gani?"
User:  "Monthly"
Taji:  "Sawa! Utapata prompt ya M-Pesa kwenye namba yako 0712XXXXXX.
        Ingiza PIN yako kukamilisha malipo ya KES 99."
        [STK Push sent]
User:  [Enters PIN on phone]
Taji:  "✅ Malipo yamepokewa! Mpesa: QJK3XY7Z9P
        Sasa una premium access. Tuanze CV yako ya pro!"
```

### Elim — School Subscription
```
Admin: "Ninataka kulipia subscription ya shule yangu"
Elim:  "Shule yako: Greenfield Primary. Wanafunzi: 120.
        Bei ya mwezi: KES 2,400 (KES 20/mwanafunzi).
        Utapata STK push kwenye 0722XXXXXX."
        [STK Push sent]
```

---

## Security Considerations

1. **Callback URL is public** — validate every callback has a matching `CheckoutRequestID` in D1
2. **Never trust callback amount** — always verify against what was requested
3. **Idempotency** — check `MpesaReceiptNumber` uniqueness before processing
4. **Phone format** — always normalise to `2547XXXXXXXX` (no +, no leading 0)
5. **Credentials** — stored encrypted in D1 `agents.api_keys`, loaded at runtime only

---

## Roadmap

| Feature | Phase |
|---------|-------|
| STK Push (individual users) | Phase 5 |
| Transaction history in dashboard | Phase 5 |
| School subscription (bulk) | Phase 6 |
| B2C refunds | Phase 6 |
| M-Pesa statements export | Phase 6 |
