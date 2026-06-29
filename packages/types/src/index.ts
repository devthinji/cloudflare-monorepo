// ─── Shared Types — @repo/types ───────────────────────────────────────────────

// ── API Response envelope ────────────────────────────────────────────────────

export type ApiResponse<T = unknown> =
  | { success: true;  data: T; message?: string }
  | { success: false; error: string }

// ── Worker Environments ──────────────────────────────────────────────────────

export interface BaseWorkerEnv {
  ENVIRONMENT?: string
  LOG_LEVEL?:   string
}

export interface GatewayEnv extends BaseWorkerEnv {
  JWT_SECRET:      string
  SESSIONS_KV:     KVNamespace
  DB:              D1Database
  AGENT_WORKER:    Fetcher
  DOCGEN_WORKER:   Fetcher
  PAYMENTS_WORKER: Fetcher
}

export interface AgentWorkerEnv extends BaseWorkerEnv {
  DB:              D1Database
  AGENT_KV:        KVNamespace
  DOCS_BUCKET:     R2Bucket
  GROQ_API_KEY:    string
  JWT_SECRET:      string
  DOCGEN_WORKER:   Fetcher
  PAYMENTS_WORKER: Fetcher
  AI:              unknown
  TajiAgent:       DurableObjectNamespace
  ElimAgent:       DurableObjectNamespace
}

export interface DocgenWorkerEnv extends BaseWorkerEnv {
  DB:                    D1Database
  DOCS_BUCKET:           R2Bucket
  GROQ_API_KEY:          string
  AI:                    unknown   // Cloudflare Workers AI binding
  DOCS_BUCKET_PUBLIC_URL?: string  // CDN base URL if bucket is public
}

export interface PaymentsWorkerEnv extends BaseWorkerEnv {
  DB:                   D1Database
  PAYMENTS_KV:          KVNamespace
  MPESA_CONSUMER_KEY:   string
  MPESA_CONSUMER_SECRET: string
  MPESA_PASSKEY:        string
  MPESA_SHORTCODE:      string
  MPESA_CALLBACK_URL:   string
  MPESA_ENVIRONMENT:    string
  AGENT_WORKER:         Fetcher   // notify agent on payment confirmation
}

export interface AafWorkerEnv extends BaseWorkerEnv {
  API_GATEWAY:             Fetcher
  AAF_KV:                  KVNamespace
  WHATSAPP_TOKEN:          string
  WHATSAPP_VERIFY_TOKEN:   string
  WHATSAPP_PHONE_NUMBER_ID: string
}

// ── Domain Models ─────────────────────────────────────────────────────────────

export interface Agent {
  id:            string
  name:          string
  slug:          string
  description?:  string
  systemPrompt:  string
  toolsEnabled:  string[]
  modelProvider: 'groq' | 'cloudflare-ai' | 'openai'
  modelId:       string
  channel:       'whatsapp' | 'telegram' | 'sms' | 'ussd' | 'dashboard'
  channelConfig?: Record<string, unknown>
  apiKeys?:      Record<string, string>
  isActive:      boolean
  createdAt:     string
  updatedAt:     string
}

export interface Conversation {
  id:        string
  userId:    string
  agentSlug: string
  channel:   string
  status:    'active' | 'closed' | 'archived'
  context?:  Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Message {
  id:             string
  conversationId: string
  role:           'user' | 'assistant' | 'system' | 'tool'
  content:        string
  toolCall?:      Record<string, unknown>
  tokensUsed?:    number
  createdAt:      string
}

export interface Document {
  id:           string
  userId:       string
  agentSlug:    string
  type:         'cv' | 'application_letter' | 'resignation_letter' | 'cover_letter'
  title:        string
  fileUrl?:     string
  templateUsed?: string
  metadata?:    Record<string, unknown>
  createdAt:    string
}

export interface Transaction {
  id:                 string
  userId:             string
  agentSlug:          string
  provider:           'mpesa' | 'stripe'
  amount:             number
  currency:           string
  status:             'pending' | 'completed' | 'failed' | 'refunded'
  merchantRequestId?: string
  checkoutRequestId?: string
  mpesaReceiptNumber?: string
  phoneNumber?:       string
  description?:       string
  metadata?:          Record<string, unknown>
  createdAt:          string
  updatedAt:          string
}

export interface User {
  id:        string
  email:     string
  name:      string
  role:      'user' | 'admin'
  createdAt: string
}

// ── WhatsApp channel ──────────────────────────────────────────────────────────

export interface NormalisedMessage {
  from:      string
  text?:     string
  mediaUrl?: string
  type:      'text' | 'image' | 'document' | 'audio' | 'interactive'
  raw?:      unknown
}

// ── Drizzle inference helpers ─────────────────────────────────────────────────

export type InferSelect<T extends { $inferSelect: unknown }> = T['$inferSelect']
export type InferInsert<T extends { $inferInsert: unknown }> = T['$inferInsert']
