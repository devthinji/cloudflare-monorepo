import { Hono } from 'hono'
import { err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import type { Env } from './types/env'
import { router } from './routes'

const app = new Hono<{ Bindings: Env }>()

app.route('/', router)

app.onError((e, c) => {
  createLogger('whatsapp', c.env).error({ err: e }, 'wa:unhandled')
  return c.json(err('Internal server error'), 500)
})

export default app
