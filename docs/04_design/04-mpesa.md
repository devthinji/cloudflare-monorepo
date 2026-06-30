# M-Pesa Daraja API — Payment Integration

## Overview

M-Pesa via Safaricom's **Daraja API** is the primary payment method for both Taji and Elim. All transactions go through M-Pesa first.

> User has live Daraja credentials. This is a real, production-grade integration from day one.

## Daraja API Flows Used

### 1. STK Push (Lipa Na M-Pesa Online) — Primary

The most common flow. We send a payment prompt directly to the user's phone. They enter their M-Pesa PIN.

```
Platform → Daraja API → Safaricom → User's phone (STK prompt)
User enters PIN → Safaricom → Daraja callback → Our callback Worker
```

### 2. C2B (Customer to Business) — Secondary
For cases where the user initiates the payment themselves.

### 3. B2C (Business to Customer) — Roadmap
For refunds or payouts. Not needed at launch.

## Credentials

```
MPESA_CONSUMER_KEY        → Daraja app consumer key
MPESA_CONSUMER_SECRET     → Daraja app consumer secret
MPESA_SHORTCODE           → Business shortcode (Paybill or Till)
MPESA_PASSKEY             → Lipa Na M-Pesa passkey
MPESA_CALLBACK_URL        → Your Worker endpoint for callbacks
MPESA_ENVIRONMENT         → "production" (live credentials ready)
```

Stored in the `agents` table under `api_keys` (encrypted JSON). Never in code or wrangler.toml.

## Worker Design

### Transactions Worker

A dedicated Hono worker for all payment operations, called via service binding.

```
Gateway → Payments Worker (binding: PAYMENTS_WORKER)
    │
    ├── POST /stk-push      → Initiate STK push
    ├── POST /callback      → Receive Safaricom callback (public endpoint)
    ├── GET  /status/:id    → Check transaction status
    └── POST /confirm       → Confirm and unlock feature
```

### STK Push Flow

```typescript
async function getDarajaToken(): Promise<string> {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}` } }
  )
  const { access_token } = await res.json()
  return access_token
}

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
      PartyA: phone,
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
app.post('/callback', async (c) => {
  const body = await c.req.json()
  const { Body: { stkCallback } } = body

  if (stkCallback.ResultCode === 0) {
    const amount = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value
    const mpesaCode = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber').Value
    const phone = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber').Value

    await saveTransaction({ phone, amount, mpesaCode, status: 'success' })
    await unlockPremium(phone)
    await notifyUser(phone, `Payment of KES ${amount} received. Mpesa: ${mpesaCode}.`)
  } else {
    await notifyUser(phone, `Payment failed. Please try again.`)
  }

  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})
```

## Security Considerations

1. **Callback URL is public** — validate every callback has a matching `CheckoutRequestID` in D1
2. **Never trust callback amount** — always verify against what was requested
3. **Idempotency** — check `MpesaReceiptNumber` uniqueness before processing
4. **Phone format** — always normalise to `2547XXXXXXXX` (no +, no leading 0)
5. **Credentials** — stored encrypted in D1 `agents.api_keys`, loaded at runtime only
