import type { Context } from 'hono'
import type { Env } from '../../types/env'
import { getAllAgentCredentials } from '../../lib/agent-credentials'

export const verifyWebhook = async (c: Context<{ Bindings: Env }>) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge) return c.text('Forbidden', 403)

  const allCreds = await getAllAgentCredentials(c.env.DB, c.env.DB_ENCRYPTION_KEY)
  const match = allCreds.find(cred => cred.verifyToken === token)
  if (!match) return c.text('Forbidden', 403)

  return new Response(challenge, { status: 200 })
}
