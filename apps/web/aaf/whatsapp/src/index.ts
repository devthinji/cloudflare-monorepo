// ─── AAF WhatsApp Worker ───────────────────────────────────────────────────────
//
// Message flow:
//   WhatsApp → aaf-whatsapp → api-gateway → api-agent (TajiAgent / ElimAgent)
//
// Payment flow:
//   Interview done → TajiAgent initiates STK push → returns payment prompt
//   User pays → M-Pesa callback → payments worker updates DB
//   Next user message → TajiAgent polls payment status → renders doc on success
//
// Commands: /taji  /elim  /reset  /help

import { Hono } from 'hono'
import { ok, err } from '@repo/utils'
import { createLogger } from './lib/logger'
import { parseIncomingMessage, sendTextMessage, type WaWebhookPayload } from './lib/whatsapp'

interface Env {
  ENVIRONMENT:              string
  LOG_LEVEL:                string
  WHATSAPP_TOKEN:           string
  WHATSAPP_VERIFY_TOKEN:    string
  WHATSAPP_PHONE_NUMBER_ID: string
  AAF_KV:                   KVNamespace
  API_GATEWAY:              Fetcher
}

interface Session {
  agentSlug: string
  lang?:     'en' | 'sw'
}

const DEFAULT_AGENT = 'taji'

// ─── Commands ─────────────────────────────────────────────────────────────────

const COMMANDS: Record<string, (s: Session) => { reply: string; session: Session; resetAgent?: boolean }> = {
  '/taji':  (s) => ({ reply: '✅ Switched to *Taji* — your document assistant.\n\nWhat document can I help you create today?', session: { ...s, agentSlug: 'taji' } }),
  '/elim':  (s) => ({ reply: '✅ Switched to *Elim* — your CBC education assistant.\n\nWhat subject or topic can I help with?', session: { ...s, agentSlug: 'elim' } }),
  '/reset': (s) => ({ reply: '🔄 Conversation reset. How can I help you?', session: { agentSlug: s.agentSlug }, resetAgent: true }),
  '/help':  (s) => ({
    reply: `*Taji Help Menu*\n\n/taji — Document assistant (CVs, letters, NDAs)\n/elim — CBC education assistant\n/reset — Clear conversation & payment\n/help — Show this menu\n\nCurrent: *${s.agentSlug}*\n\nPayments via M-Pesa 💚`,
    session: s,
  }),
}

const app = new Hono<{ Bindings: Env }>()

// ─── Webhook verification ─────────────────────────────────────────────────────

app.get('/webhooks/whatsapp', (c) => {
  const mode      = c.req.query('hub.mode')
  const token     = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(challenge ?? '', { status: 200 })
  return c.text('Forbidden', 403)
})

// ─── Incoming WhatsApp message ────────────────────────────────────────────────

app.post('/webhooks/whatsapp', async (c) => {
  const log     = createLogger(c.env)
  const payload = await c.req.json() as WaWebhookPayload

  if (payload.object !== 'whatsapp_business_account') return c.json(ok(null))

  const incoming = parseIncomingMessage(payload)
  if (!incoming) return c.json(ok(null))

  const { from, text, phoneNumberId } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'wa:in')

  // Load session
  const sessionKey = `wa:session:${from}`
  let session: Session = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? 'null') ?? { agentSlug: DEFAULT_AGENT }

  try {
    // Handle commands
    const cmd = text.trim().toLowerCase().split(' ')[0]
    if (cmd in COMMANDS) {
      const result = COMMANDS[cmd](session)
      session = result.session
      await saveSession(c.env, sessionKey, session)

      if (result.resetAgent) {
        await callAgent(c.env, session.agentSlug, from, 'reset')
      }

      await sendTextMessage(phoneNumberId, from, result.reply, c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    // Route to agent
    const reply = await callAgent(c.env, session.agentSlug, from, 'chat', text)
    await saveSession(c.env, sessionKey, session)

    if (reply) {
      for (const chunk of splitMessage(reply)) {
        await sendTextMessage(phoneNumberId, from, chunk, c.env.WHATSAPP_TOKEN)
      }
      log.info({ from, agentSlug: session.agentSlug }, 'wa:out')
    }

  } catch (e) {
    log.error({ err: e, from }, 'wa:error')
    await sendTextMessage(phoneNumberId, from, 'Something went wrong. Please try again shortly.', c.env.WHATSAPP_TOKEN).catch(() => {})
  }

  return c.json(ok(null))
})

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'aaf-whatsapp', timestamp: new Date().toISOString() }))
)

app.onError((e, c) => {
  createLogger(c.env).error({ err: e }, 'wa:unhandled')
  return c.json(err('Internal server error'), 500)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callAgent(env: Env, agentSlug: string, userId: string, type: 'chat' | 'reset' | 'check_payment', message?: string): Promise<string> {
  const body: Record<string, string> = { agentSlug, userId, channel: 'whatsapp', type }
  if (message) body.message = message

  const res = await env.API_GATEWAY.fetch(
    new Request('https://internal/api/v1/agent/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-Channel': 'whatsapp' },
      body:    JSON.stringify(body),
    })
  )
  const data = await res.json() as { success: boolean; data?: { reply: string } }
  return data?.data?.reply ?? ''
}

async function saveSession(env: Env, key: string, session: Session): Promise<void> {
  await env.AAF_KV.put(key, JSON.stringify(session), { expirationTtl: 86400 * 30 })
}

function splitMessage(text: string, max = 4000): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > max) { if (current) chunks.push(current.trim()); current = line }
    else { current = current ? current + '\n' + line : line }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

export default app
