import type { Context } from 'hono'
import { ok } from '@repo/utils'
import type { Env } from '../types/env'

export const healthCheck = (c: Context<{ Bindings: Env }>) => {
  return c.json(ok({ status: 'ok', service: 'aaf-whatsapp', timestamp: new Date().toISOString() }))
}
