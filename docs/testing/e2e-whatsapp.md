# E2E WhatsApp Flow — Local Testing Guide

## Overview

Test the full Taji conversation flow locally via WhatsApp before deploying to Cloudflare.

## Workers to run

Start each in its own terminal:

```
# Terminal 1 — gateway
cd apps/api/gateway && wrangler dev --port 8787

# Terminal 2 — agent worker
cd apps/api/agent && wrangler dev --port 8788

# Terminal 3 — payments worker
cd apps/api/payments && wrangler dev --port 8789

# Terminal 4 — WhatsApp AAF (exposed to Meta)
cd apps/web/aaf/whatsapp && wrangler dev --port 8790
```

## Required .dev.vars per worker

Copy from the example file in each worker directory:
```
cp .dev.vars.example .dev.vars
```

### apps/web/aaf/whatsapp/.dev.vars
```
WHATSAPP_TOKEN=<Meta access token>
WHATSAPP_VERIFY_TOKEN=<any string>
WHATSAPP_PHONE_NUMBER_ID=<from Meta Business Manager>
```

### apps/api/payments/.dev.vars
```
MPESA_CONSUMER_KEY=<Daraja key>
MPESA_CONSUMER_SECRET=<Daraja secret>
MPESA_PASSKEY=<Daraja passkey>
MPESA_SHORTCODE=<your shortcode>
MPESA_CALLBACK_URL=<ngrok-url>/api/v1/payments/mpesa/callback
```

### apps/api/gateway/.dev.vars
```
OPENROUTER_API_KEY=<your key>
```

## Expose AAF to Meta webhook

```
ngrok http 8790
```

In Meta Business Manager set:
- Webhook URL: https://<ngrok-id>.ngrok.io/webhook
- Verify Token: same as WHATSAPP_VERIFY_TOKEN

## Flow checklist

1. Send any message
   Expected: greeting + name prompt

2. Enter your name
   Expected: welcome message + SKU menu

3. Pick a document number
   Expected: first field question

4. Answer all fields
   Expected: full summary + confirmation prompt

5. Reply Yes
   Expected: M-Pesa STK push on your phone

6. Enter M-Pesa PIN
   Expected: document link delivered on WhatsApp

7. Reply Yes or No to another document
   Expected: SKU menu again or farewell

## Commands

/reset — clear session and restart
/help  — show help menu

## Known gaps (not blocking this test)

- Conversation history (D1) not wired into AgentWorker yet
- Agent reactivate endpoint missing from routes
