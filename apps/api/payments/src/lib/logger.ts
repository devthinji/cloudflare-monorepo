import pino from 'pino'
import type { PaymentsWorkerEnv } from '@repo/types'

export function createLogger(env: PaymentsWorkerEnv) {
  return pino({
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'api-payments', env: env.ENVIRONMENT ?? 'development' },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
