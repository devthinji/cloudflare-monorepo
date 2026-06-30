import type { Context, MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export interface RateLimiterOptions {
  windowMs: number
  max: number
  keyGenerator?: (c: Context) => string
  message?: string
  statusCode?: ContentfulStatusCode
}

export function rateLimiter(kv: KVNamespace, opts: RateLimiterOptions): MiddlewareHandler {
  const {
    windowMs = 60_000,
    max = 60,
    keyGenerator = (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
    message = 'Too many requests, please try again later',
    statusCode = 429,
  } = opts

  return async (c, next) => {
    const key = `ratelimit:${keyGenerator(c)}`
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs

    let record: { count: number; start: number } | null = null
    try {
      const raw = await kv.get(key)
      if (raw) record = JSON.parse(raw)
    } catch {
      // KV read failed — allow the request
      return next()
    }

    if (record && record.start === windowStart) {
      if (record.count >= max) {
        const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000)
        c.header('Retry-After', String(retryAfter))
        return c.json({ success: false, error: message }, statusCode)
      }
      record.count++
    } else {
      record = { count: 1, start: windowStart }
    }

    try {
      await kv.put(key, JSON.stringify(record), { expirationTtl: Math.ceil(windowMs / 1000) })
    } catch {
      // KV write failed — allow the request
    }

    await next()
  }
}
