import pino from 'pino'
import type { GatewayEnv } from '@repo/types'

export function createLogger(env: GatewayEnv) {
  return pino({
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'api-gateway', env: env.ENVIRONMENT ?? 'development' },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
