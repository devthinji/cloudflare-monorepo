export type FieldType = 'text' | 'textarea' | 'number' | 'phone' | 'email' | 'date' | 'choice' | 'repeatable' | 'image_url'
export interface FieldChoice   { label: string; value: string }
export interface FieldCondition { field: string; operator: 'equals' | 'not_equals' | 'exists'; value?: string }
export interface FieldSchema {
  key: string; label: string; hint?: string; type: FieldType; required: boolean; order: number
  maxLength?: number; minLength?: number; choices?: FieldChoice[]; subFields?: FieldSchema[]
  minItems?: number; maxItems?: number; condition?: FieldCondition; validation?: string
}
export interface SKUSchema { templateId: string; documentType: string; tier?: string; fields: FieldSchema[]; confirmPrompt: string }
export interface CollectedField { key: string; value: unknown }
export type CollectionStatus = 'collecting' | 'confirming' | 'done' | 'cancelled'
export interface CollectionState {
  templateId: string; agentSlug: string; userId: string; conversationId: string
  schema: SKUSchema; collected: CollectedField[]; currentFieldIdx: number
  status: CollectionStatus; startedAt: string; updatedAt: string
}
export function getActiveFields(schema: SKUSchema, collected: CollectedField[]): FieldSchema[] {
  return schema.fields.filter(f => {
    if (!f.condition) return true
    const dep = collected.find(c => c.key === f.condition!.field)
    if (f.condition.operator === 'exists')     return !!dep
    if (f.condition.operator === 'equals')     return dep?.value === f.condition.value
    if (f.condition.operator === 'not_equals') return dep?.value !== f.condition.value
    return true
  }).sort((a, b) => a.order - b.order)
}
export function getCurrentField(state: CollectionState): FieldSchema | null {
  return getActiveFields(state.schema, state.collected)[state.currentFieldIdx] ?? null
}
export function isComplete(state: CollectionState): boolean {
  const active = getActiveFields(state.schema, state.collected)
  return active.filter(f => f.required).every(f => state.collected.some(c => c.key === f.key && c.value !== '' && c.value != null))
}
export function toDocxData(state: CollectionState): Record<string, unknown> {
  return Object.fromEntries(state.collected.map(c => [c.key, c.value]))
}
export function validateField(field: FieldSchema, value: string): string | null {
  if (field.required && !value.trim()) return `${field.label} is required.`
  if (field.maxLength && value.length > field.maxLength) return `Please keep it under ${field.maxLength} characters.`
  if (field.minLength && value.length < field.minLength) return `At least ${field.minLength} characters needed.`
  if (field.type === 'phone'  && !/^\+?[\d\s\-]{7,15}$/.test(value)) return `Please enter a valid phone number.`
  if (field.type === 'email'  && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `Please enter a valid email.`
  if (field.type === 'number' && isNaN(Number(value))) return `Please enter a valid number.`
  if (field.validation && !new RegExp(field.validation).test(value)) return `Invalid format for ${field.label}.`
  if (field.choices?.length && !field.choices.some(c => c.value === value)) return `Choose: ${field.choices.map(c => c.label).join(', ')}.`
  return null
}
