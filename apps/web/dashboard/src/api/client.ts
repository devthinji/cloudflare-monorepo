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

// ── Agents ────────────────────────────────────────────────────────────────────

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
  list:   ()                             => request<Agent[]>('GET',  '/api/v1/agent/agents'),
  get:    (slug: string)                 => request<Agent>  ('GET',  `/api/v1/agent/agents/${slug}`),
  create: (data: AgentCreateInput)       => request<Agent>  ('POST', '/api/v1/agent/agents', data),
  update: (slug: string, data: AgentUpdateInput) =>
                                            request<Agent>  ('PUT',  `/api/v1/agent/agents/${slug}`, data),
}

// ── Conversations ─────────────────────────────────────────────────────────────

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

// ── Documents ─────────────────────────────────────────────────────────────────

export interface Document {
  id:           string
  userId:       string
  agentSlug:    string
  type:         string
  title:        string
  fileUrl?:     string
  templateUsed?: string
  createdAt:    string
}

export const documentsApi = {
  list: (userId: string) => request<Document[]>('GET', `/api/v1/docgen/documents/${userId}`),
}

// ── Templates (SKUs) ──────────────────────────────────────────────────────────

export interface Template {
  id:               string
  name:             string
  slug:             string
  description?:     string
  documentType:     string
  tier?:            string
  agentSlugs:       string   // JSON string[]
  r2Key:            string
  previewUrl?:      string
  fieldSchema:      string   // JSON FieldSchema[]
  price:            number
  currency:         string
  isActive:         boolean
  extractionStatus: 'pending' | 'processing' | 'done' | 'failed'
  extractionError?: string
  createdAt:        string
  updatedAt:        string
}

export const templatesApi = {
  list:   ()                              => request<Template[]>('GET',    '/api/v1/templates'),
  get:    (id: string)                    => request<Template>  ('GET',    `/api/v1/templates/${id}`),
  update: (id: string, data: Partial<Template>) =>
                                             request<Template>  ('PUT',    `/api/v1/templates/${id}`, data),
  delete: (id: string)                    => request<void>      ('DELETE', `/api/v1/templates/${id}`),

  upload: (formData: FormData)            => fetch(
    `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/v1/templates/upload`,
    {
      method: 'POST',
      headers: localStorage.getItem('token')
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {},
      body: formData,
    }
  ).then(r => r.json()) as Promise<{ success: boolean; data?: { id: string; extractionStatus: string }; error?: string }>,
}
