export interface Env {
  ENVIRONMENT:              string
  LOG_LEVEL:                string
  WHATSAPP_TOKEN:           string
  WHATSAPP_VERIFY_TOKEN:    string
  WHATSAPP_PHONE_NUMBER_ID: string
  AAF_KV:                   KVNamespace
  API_GATEWAY:              Fetcher
}

export interface Session { agentSlug?: string }
export const DEFAULT_AGENT = 'default'
