// ─── AAF WhatsApp Worker ───────────────────────────────────────────────────────
//
// All messages go through the ConversationMachine in api-gateway:
//   WhatsApp → aaf-whatsapp → api-gateway /api/v1/machine/advance
//
// Machine drives: Identify → Auth → Collect/Fill/Deliver → Farewell
//
// Commands: /reset  /help  /taji  /elim

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

interface Session { agentSlug: string }
const DEFAULT_AGENT = 'taji'

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

// ─── Incoming message ─────────────────────────────────────────────────────────
app.post('/webhooks/whatsapp', async (c) => {
  const log     = createLogger(c.env)
  const payload = await c.req.json() as WaWebhookPayload
  if (payload.object !== 'whatsapp_business_account') return c.json(ok(null))

  const incoming = parseIncomingMessage(payload)
  if (!incoming) return c.json(ok(null))

  const { from, text, phoneNumberId } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'wa:in')

  const sessionKey = `wa:session:${from}`
  let session: Session = JSON.parse(await c.env.AAF_KV.get(sessionKey) ?? 'null') ?? { agentSlug: DEFAULT_AGENT }

  try {
    // ── Built-in commands ────────────────────────────────────────────────────
    const cmd = text.trim().toLowerCase().split(' ')[0]

    if (cmd === '/help') {
      await sendTextMessage(phoneNumberId, from,
        `*Taji Help*\n\n/reset — Clear conversation\n/taji — Document assistant\n/elim — Education assistant\n/help — This menu`,
        c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    if (cmd === '/taji' || cmd === '/elim') {
      session.agentSlug = cmd === '/elim' ? 'elim' : 'taji'
      await c.env.AAF_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 86400 * 30 })
      // Reset machine context for new agent
      await resetMachine(c.env, from, session.agentSlug)
      const name = session.agentSlug === 'elim' ? 'Elim (CBC education)' : 'Taji (document assistant)'
      await sendTextMessage(phoneNumberId, from, `✅ Switched to *${name}*. Send anything to begin.`, c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    if (cmd === '/reset') {
      await resetMachine(c.env, from, session.agentSlug)
      await sendTextMessage(phoneNumberId, from, `🔄 Conversation reset. Send anything to start fresh.`, c.env.WHATSAPP_TOKEN)
      return c.json(ok(null))
    }

    // ── Route through ConversationMachine ────────────────────────────────────
    const res = await c.env.API_GATEWAY.fetch(
      new Request('https://internal/api/v1/machine/advance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal': 'aaf-whatsapp', 'X-Channel': 'whatsapp' },
        body: JSON.stringify({ agentSlug: session.agentSlug, userId: from, channel: 'whatsapp', message: text }),
      })
    )

    const data = await res.json() as { success: boolean; data?: { reply: string; stage: string; done: boolean } }
    const reply = data?.data?.reply ?? ''

    await c.env.AAF_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 86400 * 30 })

    if (reply) {
      for (const chunk of splitMessage(reply)) {
        await sendTextMessage(phoneNumberId, from, chunk, c.env.WHATSAPP_TOKEN)
      }
      log.info({ from, agentSlug: session.agentSlug, stage: data?.data?.stage }, 'wa:out')
    }

  } catch (e) {
    log.error({ err: e, from }, 'wa:error')
    await sendTextMessage(phoneNumberId, from, 'Something went wrong. Please try again shortly.', c.env.WHATSAPP_TOKEN).catch(() => {})
  }

  return c.json(ok(null))
})

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'aaf-whatsapp', timestamp: new Date().toISOString() })))
app.onError((e, c) => { createLogger(c.env).error({ err: e }, 'wa:unhandled'); return c.json(err('Internal server error'), 500) })

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function resetMachine(env: Env, userId: string, agentSlug: string): Promise<void> {
  await env.API_GATEWAY.fetch(
    new Request(`https://internal/api/v1/machine/context/${encodeURIComponent(userId)}/${agentSlug}`, {
      method: 'DELETE', headers: { 'X-Internal': 'aaf-whatsapp' },
    })
  )
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
