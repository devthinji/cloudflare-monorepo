import { Hono } from 'hono'
import type { GatewayEnv } from '@repo/types'
import { ok, err, signJwt, verifyJwt, generateId, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'

export const authRoutes = new Hono<{ Bindings: GatewayEnv }>()

// ── Register ──────────────────────────────────────────────────────────────────

authRoutes.post('/register', async (c) => {
  const log = createLogger('gateway', c.env)
  let body: { email: string; password: string; name: string }

  try {
    body = await c.req.json()
    if (!body.email || !body.password || !body.name) throw new Error()
  } catch {
    return c.json(err('email, password and name are required'), 400)
  }

  const existing = await c.env.SESSIONS_KV.get(`user:email:${body.email}`)
  if (existing) return c.json(err('Email already registered'), 409)

  const hash = btoa(String.fromCharCode(...new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.password + c.env.JWT_SECRET))
  )))

  const id   = generateId()
  const ts   = now()
  const user = { id, email: body.email, name: body.name, role: 'user', createdAt: ts }

  await Promise.all([
    c.env.SESSIONS_KV.put(`user:${id}`,              JSON.stringify({ ...user, hash })),
    c.env.SESSIONS_KV.put(`user:email:${body.email}`, id),
  ])

  const token = await signJwt({ sub: id, email: body.email, role: 'user' }, c.env.JWT_SECRET)
  log.info({ id, email: body.email }, 'registered')
  return c.json(ok({ user, token }), 201)
})

// ── Login ─────────────────────────────────────────────────────────────────────

authRoutes.post('/login', async (c) => {
  const log = createLogger('gateway', c.env)
  let body: { email: string; password: string }

  try {
    body = await c.req.json()
    if (!body.email || !body.password) throw new Error()
  } catch {
    return c.json(err('email and password are required'), 400)
  }

  const userId = await c.env.SESSIONS_KV.get(`user:email:${body.email}`)
  if (!userId) return c.json(err('Invalid credentials'), 401)

  const raw = await c.env.SESSIONS_KV.get(`user:${userId}`)
  if (!raw) return c.json(err('Invalid credentials'), 401)

  const stored = JSON.parse(raw) as { hash: string; id: string; email: string; name: string; role: string; createdAt: string }

  const hash = btoa(String.fromCharCode(...new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.password + c.env.JWT_SECRET))
  )))

  if (hash !== stored.hash) {
    log.warn({ email: body.email }, 'login failed')
    return c.json(err('Invalid credentials'), 401)
  }

  const { hash: _, ...user } = stored
  const token = await signJwt({ sub: user.id, email: user.email, role: user.role }, c.env.JWT_SECRET)

  log.info({ id: user.id }, 'logged in')
  return c.json(ok({ user, token }))
})

// ── Me ────────────────────────────────────────────────────────────────────────

authRoutes.get('/me', async (c) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return c.json(err('Unauthorized'), 401)

  const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json(err('Invalid or expired token'), 401)

  const raw = await c.env.SESSIONS_KV.get(`user:${payload.sub}`)
  if (!raw) return c.json(err('User not found'), 404)

  const { hash: _, ...user } = JSON.parse(raw)
  return c.json(ok(user))
})

// ── Logout ────────────────────────────────────────────────────────────────────

authRoutes.post('/logout', (c) => c.json(ok({ message: 'Logged out' })))
