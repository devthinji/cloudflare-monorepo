import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'
import { rateLimiter } from 'hono-rate-limiter'
import type { GatewayEnv } from '@repo/types'
import { err } from '@repo/utils'
import { createLogger } from './lib/logger'
import { jwtMiddleware } from './middleware/auth'

import { healthRoutes }   from './routes/health'
import { authRoutes }     from './routes/auth'
import { agentRoutes }    from './routes/agent'
import { docgenRoutes }   from './routes/docgen'
import { paymentsRoutes } from './routes/payments'
import { machineRoutes }  from './routes/machine'

// ─── App ──────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: GatewayEnv }>()

// ─── Pino request logger ──────────────────────────────────────────────────────

app.use('*', async (c, next) => {
  const log   = createLogger(c.env)
  const start = Date.now()
  await next()
  log.info({
    method: c.req.method,
    path:   c.req.path,
    status: c.res.status,
    ms:     Date.now() - start,
    ip:     c.req.header('CF-Connecting-IP'),
  }, 'request')
})

// ─── Rate limiting — 60 req/min per IP ───────────────────────────────────────

app.use('*', rateLimiter({
  windowMs:        60_000,
  limit:           60,
  standardHeaders: 'draft-6',
  keyGenerator:    (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', timing())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://dashboard.yourdomain.com',
    ]
    return allowed.includes(origin) ? origin : allowed[0]!
  },
  allowMethods:  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders:  ['Content-Type', 'Authorization'],
  credentials:   true,
}))

// ─── Public routes ────────────────────────────────────────────────────────────

app.route('/health',           healthRoutes)
app.route('/api/v1/auth',      authRoutes)

// M-Pesa callback is public (Safaricom calls it directly)
app.route('/webhooks',         paymentsRoutes)

// ─── Protected routes (JWT required) ─────────────────────────────────────────

// Machine routes — called by AAF workers via service binding (X-Internal header)
// No JWT required for internal service calls; still rate-limited
app.route('/api/v1/machine',  machineRoutes)

app.use('/api/v1/agent/*',    jwtMiddleware)
app.use('/api/v1/docgen/*',   jwtMiddleware)
app.use('/api/v1/templates/*', jwtMiddleware)  // admin: require JWT
app.use('/api/v1/payments/*', jwtMiddleware)

app.route('/api/v1/agent',    agentRoutes)
app.route('/api/v1/docgen',   docgenRoutes)
app.route('/api/v1/templates', docgenRoutes)  // templates proxied to docgen
app.route('/api/v1/payments', paymentsRoutes)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) => c.json(err('Route not found'), 404))

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((error, c) => {
  const log = createLogger(c.env)
  log.error({ err: error }, 'unhandled gateway error')
  return c.json(err('Internal server error'), 500)
})

export default app
