import { Hono } from 'hono'
import type { GatewayEnv } from '@repo/types'

// ── Proxy to PAYMENTS_WORKER via service binding ──────────────────────────────
// /api/v1/payments/* and /webhooks/mpesa (public — no JWT)

export const paymentsRoutes = new Hono<{ Bindings: GatewayEnv }>()

paymentsRoutes.all('/*', async (c) => {
  const url     = new URL(c.req.url)
  const headers = new Headers(c.req.raw.headers)
  headers.set('X-Internal', 'gateway')

  const res = await c.env.PAYMENTS_WORKER.fetch(
    new Request(url.toString(), {
      method:  c.req.method,
      headers,
      body:    ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    })
  )

  return res
})
