import { Hono } from 'hono'
import { ok, err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { parseIncomingSms, sendSms } from './lib/africastalking'

interface Env {
  ENVIRONMENT:              string
  LOG_LEVEL:                string
  AFRICASTALKING_API_KEY:   string
  AFRICASTALKING_USERNAME:  string
  AFRICASTALKING_SENDER_ID: string
  AAF_KV:                   KVNamespace
  API_GATEWAY:              Fetcher
}

interface Session {
  agentSlug?:      string
  conversationId?: string
}

const app = new Hono<{ Bindings: Env }>()

// ── Incoming SMS (Africa's Talking POST callback) ─────────────────────────────

app.post('/webhooks/sms', async (c) => {
  const log  = createLogger('sms', c.env)
  const body = await c.req.parseBody() as Record<string, string>

  const incoming = parseIncomingSms(body)
  if (!incoming) {
    log.warn('sms:invalid_payload')
    return c.text('', 200) // AT expects 200 even for ignored messages
  }

  const { from, text } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'sms:message')

  try {
    const sessionKey = `sms:session:${from}`
    const session    = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? '{}') as Session
    const agentSlug  = session.agentSlug ?? 'default'

    const res = await c.env.API_GATEWAY.fetch(
      new Request('https://internal/api/v1/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': from, 'X-Channel': 'sms' },
        body: JSON.stringify({ agentSlug, userId: from, message: text, conversationId: session.conversationId }),
      })
    )

    const data = await res.json() as { success: boolean; data?: { reply: string; conversationId: string } }

    if (!data.success || !data.data) {
      await sendSms(from, 'Sorry, something went wrong. Please try again.',
        c.env.AFRICASTALKING_API_KEY, c.env.AFRICASTALKING_USERNAME, c.env.AFRICASTALKING_SENDER_ID)
      return c.text('', 200)
    }

    const { reply, conversationId } = data.data

    // SMS: truncate to 160 chars per part (keep first part for now)
    const smsReply = reply.length > 459 ? reply.slice(0, 456) + '...' : reply

    await c.env.AAF_KV.put(sessionKey, JSON.stringify({ ...session, conversationId }), { expirationTtl: 86400 * 7 })
    await sendSms(from, smsReply, c.env.AFRICASTALKING_API_KEY, c.env.AFRICASTALKING_USERNAME, c.env.AFRICASTALKING_SENDER_ID)
    log.info({ from, agentSlug, conversationId }, 'sms:reply:sent')

  } catch (e) {
    log.error({ err: e }, 'sms:error')
    await sendSms(from, 'Something went wrong. Please try again shortly.',
      c.env.AFRICASTALKING_API_KEY, c.env.AFRICASTALKING_USERNAME, c.env.AFRICASTALKING_SENDER_ID).catch(() => {})
  }

  return c.text('', 200)
})

// ── Delivery report callback ──────────────────────────────────────────────────

app.post('/webhooks/sms/delivery', async (c) => {
  const log  = createLogger('sms', c.env)
  const body = await c.req.parseBody() as Record<string, string>
  log.info({ status: body.status, id: body.id, number: body.phoneNumber }, 'sms:delivery')
  return c.text('', 200)
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'aaf-sms', timestamp: new Date().toISOString() }))
)

app.onError((error, c) => {
  createLogger('sms', c.env).error({ err: error }, 'aaf-sms:unhandled')
  return c.json(err('Internal server error'), 500)
})

export default app
