import pino from 'pino'
import type { MiddlewareHandler } from 'hono'
import { getServiceStyle, getTagWidth } from './service-colors'
import * as clr from './colors'

const levelNames: Record<number, string> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal',
}

const levelIcons: Record<string, string> = {
  trace: '🔍', debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌', fatal: '🚨',
}

function prettyPrint(service: string, level: string, msg: string, meta?: Record<string, unknown>) {
  const style = getServiceStyle(service)
  const icon = levelIcons[level] ?? '•'
  const tag = `${style.icon} [${style.tag.padEnd(getTagWidth())}]`

  const parts: string[] = [`${tag} ${icon} ${msg}`]

  if (meta) {
    const err = meta.err
    if (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      parts.push(clr.dim(`(${errMsg})`))
    }
    const rest = Object.entries(meta)
      .filter(([k, v]) => k !== 'err' && k !== 'level' && k !== 'time' && k !== 'msg' && k !== 'pid' && k !== 'hostname' && k !== 'service' && typeof v !== 'object')
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

export function createLogger(service: string, env?: LoggerEnv) {
  const isDev = !env || (env.ENVIRONMENT ?? 'development') === 'development'

  if (isDev) {
    return pino({
      level: env?.LOG_LEVEL ?? 'info',
      browser: {
        write: (o: object) => {
          const record = o as Record<string, unknown>
          const levelNum = (record.level as number) ?? 30
          const level = levelNames[levelNum] ?? 'info'
          const msg = (record.msg as string) ?? ''
          prettyPrint(service, level, msg, record)
        },
      },
    })
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
    const method = c.req.method
    const path = c.req.path
    const status = c.res.status
    const elapsed = ms > 999 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
    const env = (c as any).env as LoggerEnv | undefined
    const log = createLogger(service, env)
    log.info({ ms }, `${method} ${path} → ${status} (${elapsed})`)
  }
}
