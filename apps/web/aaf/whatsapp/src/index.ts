// ─── AAF WhatsApp Worker ───────────────────────────────────────────────────────
//
// Receives WhatsApp webhooks, parses incoming messages,
// routes them to TajiAgent (default) or ElimAgent via the API Gateway,
// and sends replies back via the WhatsApp Cloud API.
//
// Session state (agentSlug, interviewMode) stored in KV per user.
// Commands: /taji, /elim, /reset, /help

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
  agentSlug: string   // 'taji' | 'elim'
  lang?:     string   // 'en' | 'sw'
}

const DEFAULT_AGENT = 'taji'

// ── Commands ──────────────────────────────────────────────────────────────────

const COMMANDS: Record<string, (session: Session) => { reply: string; session: Session }> = {
  '/taji':  (s) => ({ reply: '✅ Switched to *Taji* — your document assistant.\n\nWhat document can I help you create today?', session: { ...s, agentSlug: 'taji' } }),
  '/elim':  (s) => ({ reply: '✅ Switched to *Elim* — your CBC education assistant.\n\nWhat subject or topic can I help with?', session: { ...s, agentSlug: 'elim' } }),
  '/reset': (s) => ({ reply: '🔄 Conversation reset. How can I help you?', session: { agentSlug: s.agentSlug } }),
  '/help':  (s) => ({ reply: `*Available commands:*\n\n/taji — Switch to document assistant\n/elim — Switch to education assistant\n/reset — Clear conversation\n/help — Show this menu\n\nCurrent agent: *${s.agentSlug}*`, session: s }),
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
  if (!incoming) return c.json(ok(null))  // ignore non-text events (status updates etc.)

  const { from, text, phoneNumberId } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'wa:in')

  // ── Load session ────────────────────────────────────────────────────────────
  const sessionKey = `wa:session:${from}`
  let session: Session = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? 'null') ?? { agentSlug: DEFAULT_AGENT }

  try {
    // ── Handle commands ────────────────────────────────────────────────────────
    const cmd = text.trim().toLowerCase().split(' ')[0]
    if (cmd in COMMANDS) {
      const result = COMMANDS[cmd](session)
      session = result.session
      await c.env.AAF_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 86400 * 30 })

      // On /reset, also tell the agent to clear its Durable Object state
      if (cmd === '/reset') {
        await callAgent(c.env, session.agentSlug, from, 'reset', undefined, phoneNumberId)
      }

      await sendTextMessage(phoneNumberId, from, result.reply, c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    // ── Route to agent ─────────────────────────────────────────────────────────
    const reply = await callAgent(c.env, session.agentSlug, from, 'chat', text, phoneNumberId)

    // Save session (agentSlug may have been set on first message)
    await c.env.AAF_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 86400 * 30 })

    if (reply) {
      // WhatsApp has a 4096 char message limit — split if needed
      const chunks = splitMessage(reply)
      for (const chunk of chunks) {
        await sendTextMessage(phoneNumberId, from, chunk, c.env.WHATSAPP_TOKEN)
      }
      log.info({ from, agentSlug: session.agentSlug, chunks: chunks.length }, 'wa:out')
    }

  } catch (e) {
    log.error({ err: e, from }, 'wa:error')
    await sendTextMessage(
      phoneNumberId, from,
      'Something went wrong on our end. Please try again in a moment.',
      c.env.WHATSAPP_TOKEN
    ).catch(() => {})
  }

  return c.json(ok(null))
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'aaf-whatsapp', timestamp: new Date().toISOString() }))
)

app.onError((error, c) => {
  createLogger(c.env).error({ err: error }, 'wa:unhandled')
  return c.json(err('Internal server error'), 500)
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callAgent(
  env:           Env,
  agentSlug:     string,
  userId:        string,
  type:          'chat' | 'reset',
  message?:      string,
  phoneNumberId?: string,
): Promise<string> {
  const body: Record<string, string> = { agentSlug, userId, channel: 'whatsapp', type }
  if (message) body.message = message

  const res = await env.API_GATEWAY.fetch(
    new Request('https://internal/api/v1/agent/chat', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id':    userId,
        'X-Channel':    'whatsapp',
      },
      body: JSON.stringify(body),
    })
  )

  const data = await res.json() as { success: boolean; data?: { reply: string } }
  return data?.data?.reply ?? ''
}

// Split long replies into WhatsApp-safe chunks (max 4000 chars, split on newline)
function splitMessage(text: string, max = 4000): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > max) {
      if (current) chunks.push(current.trim())
      current = line
    } else {
      current = current ? current + '\n' + line : line
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

export default app
