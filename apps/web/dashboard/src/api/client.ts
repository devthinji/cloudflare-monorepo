// ─── Dashboard API Client ─────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token')
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json() as { success: boolean; data?: T; error?: string }
  if (!json.success) throw new Error(json.error ?? 'Unknown error')
  return json.data as T
}

// ── Agents ─────────────────────────────────────────────────────────────────────

export interface Agent {
  id:            string
  name:          string
  slug:          string
  description?:  string
  systemPrompt:  string
  modelProvider: string
  modelId:       string
  channel:       string
  isActive?:     boolean
  createdAt:     string
  updatedAt:     string
}
export type AgentCreateInput = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>
export type AgentUpdateInput = Partial<AgentCreateInput>

export const agentsApi = {
  list:   ()                                     => request<Agent[]>('GET',  '/api/v1/agent/agents'),
  get:    (slug: string)                         => request<Agent>  ('GET',  `/api/v1/agent/agents/${slug}`),
  create: (data: AgentCreateInput)               => request<Agent>  ('POST', '/api/v1/agent/agents', data),
  update: (slug: string, data: AgentUpdateInput) => request<Agent>  ('PUT',  `/api/v1/agent/agents/${slug}`, data),
}

// ── Conversations ──────────────────────────────────────────────────────────────

export interface Conversation {
  id:        string
  userId:    string
  agentSlug: string
  channel:   string
  status:    string
  createdAt: string
  updatedAt: string
}
export const conversationsApi = {
  list: (userId: string) => request<Conversation[]>('GET', `/api/v1/agent/conversations/${userId}`),
}

// ── Documents ──────────────────────────────────────────────────────────────────

export interface Document {
  id:            string
  userId:        string
  agentSlug:     string
  type:          string
  title:         string
  fileUrl?:      string
  templateUsed?: string
  createdAt:     string
}
export const documentsApi = {
  list:    (userId: string) => request<Document[]>('GET', `/api/v1/docgen/documents?userId=${encodeURIComponent(userId)}`),
  listAll: ()               => request<Document[]>('GET', '/api/v1/docgen/documents/all'),
}

// ── SKUs ───────────────────────────────────────────────────────────────────────

export interface FieldChoice { label: string; value: string }
export interface FieldCondition { field: string; operator: string; value?: string }

export interface SKUField {
  key:        string
  label:      string
  hint?:      string
  type:       'text' | 'textarea' | 'number' | 'phone' | 'email' | 'date' | 'choice' | 'repeatable' | 'image_url'
  required:   boolean
  order:      number
  maxLength?: number
  choices?:   FieldChoice[]
  condition?: FieldCondition
}

export interface SKU {
  id:                string
  name:              string
  slug:              string
  description?:      string
  agentSlug:         string
  templateType:      string
  fileKey:           string
  previewKey?:       string
  markdownPreview?:  string
  price:             number
  currency:          string
  fieldSchema:       SKUField[]    // parsed
  conversationSteps?: unknown
  isActive:          boolean       // 0/1 from DB mapped to boolean
  requiresReview:    boolean
  version:           number
  createdAt:         string
  updatedAt:         string
}

export interface SKUUploadResult {
  id:              string
  slug:            string
  name:            string
  fieldSchema:     SKUField[]
  description?:    string
  markdownPreview?: string
  requiresReview:  boolean
  status:          string
  message:         string
}

export const skusApi = {
  list: (agentSlug?: string, activeOnly?: boolean) => {
    const params = new URLSearchParams()
    if (agentSlug)  params.set('agentSlug', agentSlug)
    if (activeOnly) params.set('active', 'true')
    return request<SKU[]>('GET', `/api/v1/docgen/skus?${params}`)
  },

  get: (id: string) => request<SKU>('GET', `/api/v1/docgen/skus/${id}`),

  update: (id: string, data: Partial<Pick<SKU, 'name' | 'price' | 'agentSlug' | 'fieldSchema' | 'conversationSteps' | 'isActive' | 'description'>>) =>
    request<{ updated: boolean; version: number }>('PATCH', `/api/v1/docgen/skus/${id}`, data),

  publish: (id: string) =>
    request<{ updated: boolean; version: number }>('PATCH', `/api/v1/docgen/skus/${id}`, { isActive: true }),

  unpublish: (id: string) =>
    request<{ updated: boolean; version: number }>('PATCH', `/api/v1/docgen/skus/${id}`, { isActive: false }),

  delete: (id: string) => request<{ deleted: boolean }>('DELETE', `/api/v1/docgen/skus/${id}`),

  upload: (formData: FormData): Promise<{ success: boolean; data?: SKUUploadResult; error?: string }> =>
    fetch(`${BASE_URL}/api/v1/docgen/skus/upload`, {
      method:  'POST',
      headers: localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {},
      body:    formData,
    }).then(r => r.json()),

  pipelines: () => request<{ converters: { input: string; output: string }[] }>('GET', '/api/v1/docgen/pipelines'),
}

// Legacy alias so old imports don't break
export type Template = SKU
export const templatesApi = skusApi
