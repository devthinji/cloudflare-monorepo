import pino from 'pino'
import type { AgentWorkerEnv } from '@repo/types'

export function createLogger(env: AgentWorkerEnv) {
  return pino({
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'api-agent', env: env.ENVIRONMENT ?? 'development' },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
