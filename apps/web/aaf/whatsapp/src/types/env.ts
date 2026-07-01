export interface Env {
  ENVIRONMENT:           string
  LOG_LEVEL:             string
  DB_ENCRYPTION_KEY:     string
  DB:                    D1Database
  AAF_KV:                KVNamespace
  API_GATEWAY:           Fetcher
}

export interface Session {
  agentSlug?: string
  pendingReset?: boolean
}
export const DEFAULT_AGENT = 'taji'
