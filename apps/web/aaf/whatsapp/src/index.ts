import { Hono } from 'hono'
import { ok, err } from '@repo/utils'
import { createLogger } from './lib/logger'
import {
  parseIncomingMessage, sendTextMessage, type WaWebhookPayload,
} from './lib/whatsapp'

interface Env {
  ENVIRONMENT:            string
  LOG_LEVEL:              string
  WHATSAPP_TOKEN:         string
  WHATSAPP_VERIFY_TOKEN:  string
  WHATSAPP_PHONE_NUMBER_ID: string
  AAF_KV:                 KVNamespace
  API_GATEWAY:            Fetcher
}

interface Session {
  agentSlug?:      string
  conversationId?: string
}

const app = new Hono<{ Bindings: Env }>()

// ── Webhook verification ──────────────────────────────────────────────────────

app.get('/webhooks/whatsapp', (c) => {
  const mode      = c.req.query('hub.mode')
  const token     = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(challenge ?? '', { status: 200 })
  return c.text('Forbidden', 403)
})

// ── Incoming message ──────────────────────────────────────────────────────────

app.post('/webhooks/whatsapp', async (c) => {
  const log     = createLogger(c.env)
  const payload = await c.req.json() as WaWebhookPayload

  if (payload.object !== 'whatsapp_business_account') return c.json(ok(null))

  const incoming = parseIncomingMessage(payload)
  if (!incoming) return c.json(ok(null))

  const { from, text, phoneNumberId } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'wa:message')

  try {
    const sessionKey = `wa:session:${from}`
    const session    = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? '{}') as Session
    const agentSlug  = session.agentSlug ?? 'taji'

    const res = await c.env.API_GATEWAY.fetch(
      new Request('https://internal/api/v1/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': from, 'X-Channel': 'whatsapp' },
        body: JSON.stringify({ agentSlug, userId: from, message: text, conversationId: session.conversationId }),
      })
    )

    const data = await res.json() as { success: boolean; data?: { reply: string; conversationId: string } }

    if (!data.success || !data.data) {
      await sendTextMessage(phoneNumberId, from, 'Sorry, something went wrong. Please try again.', c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    const { reply, conversationId } = data.data
    await c.env.AAF_KV.put(sessionKey, JSON.stringify({ ...session, conversationId }), { expirationTtl: 86400 * 7 })
    await sendTextMessage(phoneNumberId, from, reply, c.env.WHATSAPP_TOKEN)
    log.info({ from, agentSlug, conversationId }, 'wa:reply:sent')

  } catch (e) {
    log.error({ err: e }, 'wa:error')
    await sendTextMessage(incoming.phoneNumberId, from, 'Something went wrong. Please try again shortly.', c.env.WHATSAPP_TOKEN).catch(() => {})
  }

  return c.json(ok(null))
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'aaf-whatsapp', timestamp: new Date().toISOString() }))
)

app.onError((error, c) => {
  createLogger(c.env).error({ err: error }, 'aaf-whatsapp:unhandled')
  return c.json(err('Internal server error'), 500)
})

export default app
