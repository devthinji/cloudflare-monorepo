// ─── Dashboard API Client ─────────────────────────────────────────────────────

export const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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

// ── Messages ────────────────────────────────────────────────────────────────────

export interface Message {
  id:             string
  conversationId: string
  role:           'user' | 'assistant'
  content:        string
  toolCall?:      string
  tokensUsed?:    number
  createdAt:      string
}

export const messagesApi = {
  list: (conversationId: string) => request<Message[]>('GET', `/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/messages`),
}

// ── Documents ──────────────────────────────────────────────────────────────────

export interface Document {
  id:            string
  userId:        string
  agentSlug:     string
  type:          string
  title:         string
  fileUrl?:      string
  templateId?:   string
  templateName?: string   // joined from skus.name by listAllDocs
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
  agentAccess?:      { agentSlug: string; enabled: boolean }[]
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

  update: (id: string, data: Partial<Pick<SKU, 'name' | 'price' | 'fieldSchema' | 'conversationSteps' | 'isActive' | 'description'> & { agentAccess: { agentSlug: string; enabled: boolean }[] }>) =>
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


// ── Customers (WhatsApp end-users) ──────────────────────────────────────────────

export interface Customer {
  id:         string
  name:       string
  phone?:     string
  channel:    string
  agentSlug?: string
  registered: boolean
  blocked:    boolean
  metadata?:  Record<string, unknown>
  createdAt:  string
  updatedAt:  string
}

export const customersApi = {
  list:   ()                                             => request<Customer[]>('GET',   '/api/v1/agent/customers'),
  get:    (customerId: string)                           => request<Customer>  ('GET',   `/api/v1/agent/customers/${encodeURIComponent(customerId)}`),
  patch:  (customerId: string, data: Partial<Pick<Customer, 'name' | 'phone' | 'agentSlug' | 'blocked' | 'metadata'>>) =>
                                                           request<{ updated: boolean }>('PATCH', `/api/v1/agent/customers/${encodeURIComponent(customerId)}`, data),
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface Transaction {
  id:                  string
  userId:              string
  agentSlug:           string
  provider:            string
  amount:              number
  currency:            string
  status:              'pending' | 'completed' | 'failed'
  merchantRequestId?:  string
  checkoutRequestId?:  string
  mpesaReceiptNumber?: string
  phoneNumber?:        string
  description?:        string
  createdAt:           string
  updatedAt:           string
}

export const transactionsApi = {
  listAll:  ()                => request<Transaction[]>('GET', '/api/v1/payments/transactions'),
  listUser: (userId: string)  => request<Transaction[]>('GET', `/api/v1/payments/transactions/${encodeURIComponent(userId)}`),
}


// ── Machine Context ─────────────────────────────────────────────────────────────

export interface MachineContextData {
  userId:           string
  agentSlug:        string
  stage:            string
  collectSub?:      string
  liveSKU?:         { id: string; name: string; price: number; currency: string }
  collectedFields?: Record<string, string>
  docFileName?:     string
  sessionCount?:    number
}

export const machineApi = {
  getContext: (userId: string, agentSlug: string) =>
    request<MachineContextData>('GET', `/api/v1/machine/context/${encodeURIComponent(userId)}/${encodeURIComponent(agentSlug)}`),
  reset: (userId: string, agentSlug: string) =>
    request<{ reset: boolean }>('DELETE', `/api/v1/machine/context/${encodeURIComponent(userId)}/${encodeURIComponent(agentSlug)}`),
}

// Legacy alias so old imports don't break
export type Template = SKU
export const templatesApi = skusApi
