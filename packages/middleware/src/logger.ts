import pino from 'pino'
import type { MiddlewareHandler } from 'hono'
import { getServiceStyle, getTagWidth } from './service-colors'
import * as clr from './colors'

const levelIcons: Record<string, string> = {
  trace: '🔍', debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌', fatal: '🚨',
}

const levelColors: Record<string, (s: string) => string> = {
  trace: clr.gray, debug: clr.gray, info: clr.reset,
  warn: clr.yellow, error: clr.red, fatal: clr.red,
}

function prettyPrint(service: string, level: string, msg: string, meta?: Record<string, unknown>) {
  const style = getServiceStyle(service)
  const lc = levelColors[level] ?? clr.reset
  const li = levelIcons[level] ?? '•'
  const tag = `${style.icon} ${style.color(`[${style.tag.padEnd(getTagWidth())}]`)}`

  const parts: string[] = [`${tag} ${lc(li)} ${lc(msg)}`]

  if (meta) {
    const err = meta.err
    if (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      parts.push(clr.dim(`(${errMsg})`))
    }
    const rest = Object.entries(meta)
      .filter(([k, v]) => k !== 'err' && typeof v !== 'object')
      .map(([k, v]) => `${k}=${v}`)
    if (rest.length > 0) {
      parts.push(clr.dim(`[${rest.join(', ')}]`))
    }
  }
  console.log(parts.join(' '))
}

export interface LoggerEnv {
  ENVIRONMENT?: string
  LOG_LEVEL?: string
}

function devLog(service: string, level: string, arg1: unknown, arg2?: string) {
  if (typeof arg1 === 'string') {
    prettyPrint(service, level, arg1)
    return
  }
  const meta = (arg1 ?? {}) as Record<string, unknown>
  prettyPrint(service, level, arg2 ?? '', meta)
}

export function createLogger(service: string, env?: LoggerEnv) {
  const isDev = !env || (env.ENVIRONMENT ?? 'development') === 'development'

  if (isDev) {
    return {
      trace: (a?: unknown, b?: string) => devLog(service, 'trace', a, b),
      debug: (a?: unknown, b?: string) => devLog(service, 'debug', a, b),
      info:  (a?: unknown, b?: string) => devLog(service, 'info', a, b),
      warn:  (a?: unknown, b?: string) => devLog(service, 'warn', a, b),
      error: (a?: unknown, b?: string) => devLog(service, 'error', a, b),
      fatal: (a?: unknown, b?: string) => devLog(service, 'fatal', a, b),
    }
  }

  return pino({
    level: env?.LOG_LEVEL ?? 'info',
    base: { service },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}

export function requestLogger(service: string): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    const env = (c as any).env as LoggerEnv | undefined
    const log = createLogger(service, env)
    const status = c.res.status
    const elapsed = ms > 999 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
    const msg = `${c.req.method} ${c.req.path} → ${status} (${elapsed})`
    if (status >= 500) log.error({ ms }, msg)
    else if (status >= 400) log.warn({ ms }, msg)
    else log.info({ ms }, msg)
  }
}
