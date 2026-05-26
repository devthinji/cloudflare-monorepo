import { Hono } from 'hono'
import type { GatewayEnv } from '@repo/types'
import { ok } from '@repo/utils'
import { now } from '@repo/utils'

export const healthRoutes = new Hono<{ Bindings: GatewayEnv }>()

healthRoutes.get('/', (c) =>
  c.json(ok({ status: 'ok', service: 'api-gateway', timestamp: now() }))
)
