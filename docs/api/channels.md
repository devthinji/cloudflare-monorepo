# API-as-Frontend — Channel Worker Design

## Philosophy

The Channel Worker IS the frontend for most users. They never open a browser. They open WhatsApp.

```
Browser dashboard  → REST API  → Gateway → Workers
WhatsApp user      → Webhook   → Gateway → Channel Worker → Agent Brain → DocGen
```

## WhatsApp First (Meta Cloud API)

### Webhook Setup

```
POST /webhooks/whatsapp
  ← Meta sends all incoming messages here
  ← Verified by VERIFY_TOKEN in agent config
```

### Message Types Handled

| Type | Example | Handling |
|------|---------|---------|
| Text | "Nataka CV" | → Agent brain |
| Document | User uploads old CV | → DocGen for parsing |
| Image | User photo for CV | → Store in R2 |
| Audio | Voice note | → Deepgram (roadmap) |
| Interactive | Button replies | → Structured flow |

### Outbound Message Types

| Type | When used |
|------|----------|
| Text | Normal conversation |
| Document | Sending generated .docx |
| Template | Notifications, reminders |
| Interactive buttons | Yes/No flows, menu selection |

## Channel Worker API (Internal)

Called by Gateway via service binding:

```typescript
// Gateway → Channel Worker
interface ChannelRequest {
  agent_slug: string
  channel: 'whatsapp' | 'telegram' | 'sms'
  user_phone: string
  message: {
    type: 'text' | 'document' | 'image' | 'audio'
    content: string
    media_url?: string
  }
  raw_payload: unknown  // Original webhook payload
}
```

## Normalised Message Format

All channels (WhatsApp, Telegram, SMS) are normalised to the same internal format before hitting the agent brain. This means adding Telegram later is just writing a new normaliser — the brain doesn't change.

```typescript
interface NormalisedMessage {
  from: string          // +254712345678
  to: string            // agent's number
  text: string
  media?: {
    type: string
    url: string
  }
  timestamp: number
  platform: string
  raw: unknown
}
```

## Adding New Channels

To add Telegram:
1. Add webhook route: `POST /webhooks/telegram`
2. Write Telegram normaliser (maps Telegram payload → NormalisedMessage)
3. Add `telegram` to channel_config options in dashboard
4. The rest of the stack is unchanged

To add USSD:
1. Add webhook route: `POST /webhooks/ussd`
2. Write USSD normaliser + menu state machine
3. USSD is sessionless — store session in KV by phone + session_id

## Rate Limiting & Abuse

```
Per phone number: max 30 messages/minute (KV counter)
Per agent: max 1000 messages/minute
Blocked numbers: KV blocklist
```

## WhatsApp Webhook Verification

```typescript
app.get('/webhooks/whatsapp', (c) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  // token must match agent's channel_config.verify_token
  if (mode === 'subscribe' && token === agent.channel_config.verify_token) {
    return c.text(challenge!)
  }
  return c.text('Forbidden', 403)
})
```
