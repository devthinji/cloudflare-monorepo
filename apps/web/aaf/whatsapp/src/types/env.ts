export interface Env {
  ENVIRONMENT:              string
  LOG_LEVEL:                string
  WHATSAPP_ACCESS_TOKEN:    string
  WHATSAPP_APP_SECRET:      string
  WHATSAPP_VERIFY_TOKEN:    string
  WHATSAPP_PHONE_NUMBER_ID: string
  AAF_KV:                   KVNamespace
  API_GATEWAY:              Fetcher
}

export interface Session {
  agentSlug?: string
  pendingReset?: boolean
}
export const DEFAULT_AGENT = 'taji'
