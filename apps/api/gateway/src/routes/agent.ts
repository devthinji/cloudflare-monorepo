import { Hono } from 'hono'
import type { GatewayEnv } from '@repo/types'

export const agentRoutes = new Hono<{ Bindings: GatewayEnv }>()

// Proxy to AGENT_WORKER via service binding — preserve all AAF headers
agentRoutes.all('/*', async (c) => {
  const url     = new URL(c.req.url)
  const headers = new Headers(c.req.raw.headers)
  headers.set('X-Internal', 'gateway')
  // Preserve channel identity from AAF workers
  const channel = c.req.header('X-Channel')
  if (channel) headers.set('X-Channel', channel)
  const userId = c.req.header('X-User-Id')
  if (userId) headers.set('X-User-Id', userId)

  const res = await c.env.AGENT_WORKER.fetch(
    new Request(url.toString(), {
      method:  c.req.method,
      headers,
      body:    ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    })
  )
  return c.newResponse(res.body, res.status as any, Object.fromEntries(res.headers.entries()))
})
