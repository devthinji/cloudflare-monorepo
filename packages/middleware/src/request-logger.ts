import { requestLogger, createLogger } from './logger'
import type { LoggerEnv } from './logger'

export type LogLevel = 'success' | 'info' | 'step' | 'warn' | 'error' | 'debug'

export { requestLogger }

export function legacyLogger(service: string, env?: LoggerEnv) {
  const log = createLogger(service, env)
  return {
    success: (msg: string, meta?: Record<string, unknown>) => log.info({ ...meta }, `✅ ${msg}`),
    info:    (msg: string, meta?: Record<string, unknown>) => log.info({ ...meta }, `ℹ️ ${msg}`),
    step:    (msg: string, meta?: Record<string, unknown>) => log.info({ ...meta }, `→ ${msg}`),
    warn:    (msg: string, meta?: Record<string, unknown>) => log.warn({ ...meta }, `⚠️ ${msg}`),
    error:   (msg: string, meta?: Record<string, unknown>) => log.error({ ...meta }, `❌ ${msg}`),
    debug:   (msg: string, meta?: Record<string, unknown>) => log.debug({ ...meta }, `🔍 ${msg}`),
  }
}
