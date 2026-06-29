import type { Context } from 'hono'
import type { GatewayEnv } from '@repo/types'
import { ok } from '@repo/utils'
import { verifyJwt } from '@repo/utils'

export async function getMe(c: Context<{ Bindings: GatewayEnv }>) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)

  const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Invalid or expired token' }, 401)

  const raw = await c.env.SESSIONS_KV.get(`user:${payload.sub}`)
  if (!raw) return c.json({ error: 'User not found' }, 404)

  const { hash: _, ...user } = JSON.parse(raw)
  return c.json(ok(user))
}
