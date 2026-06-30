import { Hono } from 'hono'
import { ok, err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import {
  parseIncomingMessage, sendTextMessage, type TgUpdate,
} from './lib/telegram'

interface Env {
  ENVIRONMENT:              string
  LOG_LEVEL:                string
  TELEGRAM_BOT_TOKEN:       string
  TELEGRAM_WEBHOOK_SECRET:  string
  AAF_KV:                   KVNamespace
  API_GATEWAY:              Fetcher
}

interface Session {
  agentSlug?:      string
  conversationId?: string
}

const app = new Hono<{ Bindings: Env }>()

// ── Webhook registration helper ───────────────────────────────────────────────
// Call GET /setup?url=https://your-worker.dev/webhooks/telegram to register

app.get('/setup', async (c) => {
  const webhookUrl = c.req.query('url')
  if (!webhookUrl) return c.text('Missing ?url param', 400)

  const res = await fetch(
    `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:             webhookUrl,
        secret_token:    c.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message'],
      }),
    }
  )
  const data = await res.json()
  return c.json(data)
})

// ── Incoming update ───────────────────────────────────────────────────────────

app.post('/webhooks/telegram', async (c) => {
  const log = createLogger('telegram', c.env)

  // Verify Telegram webhook secret header
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token')
  if (secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    log.warn('tg:invalid_secret')
    return c.text('Forbidden', 403)
  }

  const update  = await c.req.json() as TgUpdate
  const incoming = parseIncomingMessage(update)
  if (!incoming) return c.json(ok(null))

  const { chatId, userId, text } = incoming
  log.info({ userId, preview: text.slice(0, 80) }, 'tg:message')

  try {
    const sessionKey = `tg:session:${userId}`
    const session    = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? '{}') as Session
    const agentSlug  = session.agentSlug ?? 'default'

    const res = await c.env.API_GATEWAY.fetch(
      new Request('https://internal/api/v1/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-Channel': 'telegram' },
        body: JSON.stringify({ agentSlug, userId, message: text, conversationId: session.conversationId }),
      })
    )

    const data = await res.json() as { success: boolean; data?: { reply: string; conversationId: string } }

    if (!data.success || !data.data) {
      await sendTextMessage(chatId, 'Sorry, something went wrong. Please try again.', c.env.TELEGRAM_BOT_TOKEN)
      return c.json(ok(null))
    }

    const { reply, conversationId } = data.data
    await c.env.AAF_KV.put(sessionKey, JSON.stringify({ ...session, conversationId }), { expirationTtl: 86400 * 7 })
    await sendTextMessage(chatId, reply, c.env.TELEGRAM_BOT_TOKEN)
    log.info({ userId, agentSlug, conversationId }, 'tg:reply:sent')

  } catch (e) {
    log.error({ err: e }, 'tg:error')
    await sendTextMessage(chatId, 'Something went wrong. Please try again shortly.', c.env.TELEGRAM_BOT_TOKEN).catch(() => {})
  }

  return c.json(ok(null))
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'aaf-telegram', timestamp: new Date().toISOString() }))
)

app.onError((error, c) => {
  createLogger('telegram', c.env).error({ err: error }, 'aaf-telegram:unhandled')
  return c.json(err('Internal server error'), 500)
})

export default app
