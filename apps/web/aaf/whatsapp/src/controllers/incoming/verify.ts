import type { Context } from 'hono'
import type { Env } from '../../types/env'

export const verifyWebhook = (c: Context<{ Bindings: Env }>) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge ?? '', { status: 200 })
  return c.text('Forbidden', 403)
}
