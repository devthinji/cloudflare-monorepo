export type MachineStage =
  | 'identify'
  | 'auth'
  | 'collect'
  | 'farewell'
  | 'closed'

export type CustomerClass =
  | 'new_unregistered'
  | 'return_unregistered'
  | 'registered'

export type CollectSubState =
  | 'sku_select'
  | 'collection'
  | 'naming'
  | 'validation'
  | 'transaction'
  | 'transaction_validation'
  | 'generation'
  | 'repetition_or_close'

export interface LiveFieldSchema {
  key: string; label: string; hint?: string; type: string; required: boolean; order: number
  choices?: { label: string; value: string }[]
  condition?: { field: string; operator: string; value?: string }
}

export interface LiveSKU {
  id: string; name: string; price: number; currency: string; fields: LiveFieldSchema[]
}

export interface MachineContext {
  userId: string; agentSlug: string; channel: string; stage: MachineStage
  customerClass: CustomerClass | null; collectSub: CollectSubState | null
  isRegistered: boolean; profileName?: string
  liveSKU?: LiveSKU; currentFieldIdx: number; collectedFields: Record<string, unknown>
  checkoutRequestId?: string; txId?: string
  docFileName?: string; sessionCount: number; createdAt: string; updatedAt: string
}

export interface DocDelivery {
  docId: string
  key: string
  filename: string
}

export function initialContext(userId: string, agentSlug: string, channel: string): MachineContext {
  return {
    userId, agentSlug, channel,
    stage: 'identify', customerClass: null, collectSub: null,
    isRegistered: false, currentFieldIdx: 0, collectedFields: {},
    sessionCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}
