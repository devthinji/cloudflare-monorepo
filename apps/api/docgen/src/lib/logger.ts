import pino from 'pino'
import type { DocgenWorkerEnv } from '@repo/types'

export function createLogger(env: DocgenWorkerEnv) {
  return pino({
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'api-docgen', env: env.ENVIRONMENT ?? 'development' },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
