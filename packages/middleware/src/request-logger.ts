import type { MiddlewareHandler } from 'hono'
import { bold, dim, red, yellow, cyan, green } from './colors'
import { getServiceStyle, getTagWidth } from './service-colors'

export type LogLevel = 'success' | 'info' | 'step' | 'warn' | 'error' | 'debug'

const levelConfig: Record<LogLevel, { icon: string; format: (s: string) => string }> = {
  success: { icon: '✅', format: bold },
  info:    { icon: 'ℹ️', format: (s) => s },
  step:    { icon: '→',  format: dim },
  warn:    { icon: '⚠️', format: yellow },
  error:   { icon: '❌', format: red },
  debug:   { icon: '🔍', format: dim },
}

function timestamp(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return dim(`${hh}:${mm}:${ss}`)
}

function paddedTag(tag: string): string {
  return tag.padEnd(getTagWidth())
}

function log(
  service: string,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const style = getServiceStyle(service)
  const cfg = levelConfig[level]
  const ts = timestamp()
  const tag = style.color(`${style.icon} [${paddedTag(style.tag)}]`)
  const lvl = cfg.format(cfg.icon)
  const msg = cfg.format(message)
  const md = meta ? dim(` (${Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(', ')})`) : ''
  console.log(`${ts} ${tag} ${lvl} ${msg}${md}`)
}

export function createLogger(service: string) {
  return {
    success: (msg: string, meta?: Record<string, unknown>) => log(service, 'success', msg, meta),
    info:    (msg: string, meta?: Record<string, unknown>) => log(service, 'info', msg, meta),
    step:    (msg: string, meta?: Record<string, unknown>) => log(service, 'step', msg, meta),
    warn:    (msg: string, meta?: Record<string, unknown>) => log(service, 'warn', msg, meta),
    error:   (msg: string, meta?: Record<string, unknown>) => log(service, 'error', msg, meta),
    debug:   (msg: string, meta?: Record<string, unknown>) => log(service, 'debug', msg, meta),
  }
}

export function requestLogger(service: string): MiddlewareHandler {
  const s = getServiceStyle(service)
  return async (c, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    const method = c.req.method
    const path = c.req.path
    const status = c.res.status
    const color = status >= 500 ? red
      : status >= 400 ? yellow
      : status >= 300 ? cyan
      : green
    const ts = timestamp()
    const tag = s.color(`${s.icon} [${paddedTag(s.tag)}]`)
    const statusStr = color(String(status))
    const elapsed = ms > 999 ? dim(`(${(ms / 1000).toFixed(1)}s)`) : dim(`(${ms}ms)`)
    console.log(`${ts} ${tag} ℹ️ ${bold(method)} ${path} ${statusStr} ${elapsed}`)
  }
}
