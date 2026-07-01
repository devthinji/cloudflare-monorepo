import { Hono } from 'hono'
import type { GatewayEnv } from '@repo/types'

// ── Proxy to DOCGEN_WORKER via service binding ────────────────────────────────

export const docgenRoutes = new Hono<{ Bindings: GatewayEnv }>()

docgenRoutes.all('/*', async (c) => {
  const url     = new URL(c.req.url)
  const headers = new Headers(c.req.raw.headers)
  headers.set('X-Internal', 'gateway')

  const res = await c.env.DOCGEN_WORKER.fetch(
    new Request(url.toString(), {
      method:  c.req.method,
      headers,
      body:    ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    })
  )
  return c.newResponse(res.body, res.status as any, Object.fromEntries(res.headers.entries()))
})
