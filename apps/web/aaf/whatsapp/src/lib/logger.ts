import pino from 'pino'

export function createLogger(env: { LOG_LEVEL?: string; ENVIRONMENT?: string }) {
  return pino({
    level: env.LOG_LEVEL ?? 'info',
    base: { service: 'aaf-whatsapp', env: env.ENVIRONMENT ?? 'development' },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}
