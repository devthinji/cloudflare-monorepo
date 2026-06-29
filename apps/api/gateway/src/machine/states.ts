// ─── Conversation State Machine — States & Transitions ───────────────────────
//
// Based on the 4-stage flow:
//   Identify → Auth → Collect/Fill/Deliver → Farewell
//
// Each stage has sub-states. The machine persists in KV keyed by userId.

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
  | 'collection'
  | 'validation'
  | 'transaction'
  | 'transaction_validation'
  | 'generation'
  | 'repetition_or_close'

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
  // Collect
  templateId?:  string
  sessionData?: Record<string, unknown>
  // Meta
  sessionCount: number   // how many completed docs this session
  createdAt:    string
  updatedAt:    string
}

export type MachineEvent =
  | { type: 'MESSAGE';         text: string }
  | { type: 'USER_FOUND';      name: string }
  | { type: 'USER_NOT_FOUND' }
  | { type: 'REGISTERED' }
  | { type: 'COLLECTION_DONE'; data: Record<string, unknown> }
  | { type: 'PAYMENT_OK' }
  | { type: 'PAYMENT_FAILED' }
  | { type: 'DOC_GENERATED';   fileUrl: string; title: string }
  | { type: 'REPEAT' }
  | { type: 'CLOSE' }

export function initialContext(userId: string, agentSlug: string, channel: string): MachineContext {
  return {
    userId, agentSlug, channel,
    stage:        'identify',
    userClass:    null,
    collectSub:   null,
    isRegistered: false,
    sessionCount: 0,
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  }
}
