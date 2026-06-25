// ─── FieldSchema — one placeholder in a template ─────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'      // long text — e.g. personal message, summary
  | 'number'
  | 'phone'
  | 'email'
  | 'date'
  | 'choice'        // enum — user picks from options
  | 'repeatable'    // array of sub-fields — e.g. work experience entries
  | 'image_url'     // user provides a link or we skip

export interface FieldChoice {
  label: string
  value: string
}

export interface FieldCondition {
  // Only show this field if another field matches a value
  // e.g. show "resignation_date" only if document_type === "resignation_letter"
  field:    string
  operator: 'equals' | 'not_equals' | 'exists'
  value?:   string
}

export interface FieldSchema {
  key:         string          // matches {placeholder} in docx
  label:       string          // question asked to user, e.g. "What is your full name?"
  hint?:       string          // example answer, e.g. "e.g. John Kamau"
  type:        FieldType
  required:    boolean
  order:       number          // interview sequence
  maxLength?:  number
  minLength?:  number
  choices?:    FieldChoice[]   // for type === 'choice'
  subFields?:  FieldSchema[]   // for type === 'repeatable'
  minItems?:   number          // for repeatable
  maxItems?:   number          // for repeatable
  condition?:  FieldCondition  // conditional display
  validation?: string          // regex pattern for extra validation
}

// ─── SKUSchema — the full schema for one template ────────────────────────────

export interface SKUSchema {
  templateId:   string
  documentType: string
  tier?:        string
  fields:       FieldSchema[]
  // Post-collection hook — what to tell agent after all fields collected
  confirmPrompt: string  // e.g. "I have everything! Shall I generate your CV now?"
}

// ─── CollectionState — runtime state per conversation ────────────────────────

export interface CollectedField {
  key:   string
  value: unknown
}

export type CollectionStatus = 'collecting' | 'confirming' | 'done' | 'cancelled'

export interface CollectionState {
  templateId:      string
  agentSlug:       string
  userId:          string
  conversationId:  string
  schema:          SKUSchema
  collected:       CollectedField[]
  currentFieldIdx: number
  status:          CollectionStatus
  startedAt:       string
  updatedAt:       string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getActiveFields(schema: SKUSchema, collected: CollectedField[]): FieldSchema[] {
  return schema.fields
    .filter(f => {
      if (!f.condition) return true
      const dep = collected.find(c => c.key === f.condition!.field)
      if (f.condition.operator === 'exists')     return !!dep
      if (f.condition.operator === 'equals')     return dep?.value === f.condition.value
      if (f.condition.operator === 'not_equals') return dep?.value !== f.condition.value
      return true
    })
    .sort((a, b) => a.order - b.order)
}

export function getCurrentField(state: CollectionState): FieldSchema | null {
  const active = getActiveFields(state.schema, state.collected)
  return active[state.currentFieldIdx] ?? null
}

export function isComplete(state: CollectionState): boolean {
  const active   = getActiveFields(state.schema, state.collected)
  const required = active.filter(f => f.required)
  return required.every(f => state.collected.some(c => c.key === f.key && c.value !== '' && c.value != null))
}

export function toDocxData(state: CollectionState): Record<string, unknown> {
  return Object.fromEntries(state.collected.map(c => [c.key, c.value]))
}

export function validateField(field: FieldSchema, value: string): string | null {
  if (field.required && !value.trim())        return `${field.label} is required.`
  if (field.maxLength && value.length > field.maxLength)
    return `Please keep it under ${field.maxLength} characters.`
  if (field.minLength && value.length < field.minLength)
    return `Please provide at least ${field.minLength} characters.`
  if (field.type === 'phone'  && !/^\+?[\d\s\-]{7,15}$/.test(value))
    return `Please enter a valid phone number.`
  if (field.type === 'email'  && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return `Please enter a valid email address.`
  if (field.type === 'number' && isNaN(Number(value)))
    return `Please enter a valid number.`
  if (field.validation && !new RegExp(field.validation).test(value))
    return `Invalid format for ${field.label}.`
  if (field.choices?.length && !field.choices.some(c => c.value === value))
    return `Please choose one of: ${field.choices.map(c => c.label).join(', ')}.`
  return null
}
