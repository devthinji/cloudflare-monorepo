// ─── Conversation State Machine — States & Transitions ───────────────────────
//
// 4-stage flow:  Identify → Auth → Collect/Fill/Deliver → Farewell
// Machine context persists in KV keyed by userId+agentSlug.
// SKU schema is loaded from docgen at runtime — no hardcoded fields.

export type MachineStage =
  | 'identify'
  | 'auth'
  | 'collect'
  | 'farewell'
  | 'closed'

export type UserClass =
  | 'new_unregistered'
  | 'return_unregistered'
  | 'registered'

export type CollectSubState =
  | 'sku_select'              // user is choosing which document
  | 'collection'              // walking SKU fields one by one
  | 'validation'              // confirming collected data
  | 'transaction'             // STK push initiated
  | 'transaction_validation'  // waiting for M-Pesa callback
  | 'generation'              // rendering doc
  | 'repetition_or_close'     // ask to repeat or end

// ─── Live SKU field (loaded from DB, stored in context) ──────────────────────

export interface LiveFieldSchema {
  key:       string
  label:     string
  hint?:     string
  type:      string
  required:  boolean
  order:     number
  choices?:  { label: string; value: string }[]
  condition?: { field: string; operator: string; value?: string }
}

export interface LiveSKU {
  id:          string
  name:        string
  price:       number
  currency:    string
  agentSlug:   string
  fields:      LiveFieldSchema[]
}

// ─── Machine context ─────────────────────────────────────────────────────────

export interface MachineContext {
  userId:       string
  agentSlug:    string
  channel:      string
  stage:        MachineStage
  userClass:    UserClass | null
  collectSub:   CollectSubState | null
  // Auth
  isRegistered: boolean
  profileName?: string
  // SKU
  liveSKU?:         LiveSKU                   // loaded from DB at sku_select
  currentFieldIdx:  number                    // which field we are on
  collectedFields:  Record<string, unknown>   // answers so far
  // Payment
  checkoutRequestId?: string
  txId?:              string
  // Meta
  sessionCount: number
  createdAt:    string
  updatedAt:    string
}

export function initialContext(userId: string, agentSlug: string, channel: string): MachineContext {
  return {
    userId, agentSlug, channel,
    stage:           'identify',
    userClass:       null,
    collectSub:      null,
    isRegistered:    false,
    currentFieldIdx: 0,
    collectedFields: {},
    sessionCount:    0,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  }
}
