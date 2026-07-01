import type { StageType } from './nodes/StageNode'

export type BlueprintEvent =
  | 'CUSTOMER_NEW'
  | 'CUSTOMER_RETURNING_UNREGISTERED'
  | 'CUSTOMER_REGISTERED'
  | 'NAME_VALID'
  | 'NAME_INVALID'
  | 'SKU_CHOSEN'
  | 'SKU_NOT_CHOSEN'
  | 'FIELD_VALID'
  | 'FIELD_INVALID'
  | 'ALL_FIELDS_DONE'
  | 'NAME_PROVIDED'
  | 'SUMMARY_CONFIRMED'
  | 'SUMMARY_REJECTED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_SKIPPED'
  | 'CONFIRM_GENERATION'
  | 'CANCEL_GENERATION'
  | 'DOC_READY'
  | 'DOC_FAILED'
  | 'WANTS_ANOTHER'
  | 'WANTS_TO_CLOSE'

export interface VisualNodeDef {
  id: string
  stage: StageType
  label: string
  description?: string
  subStages?: string[]
  position: { x: number; y: number }
}

export interface VisualEdgeDef {
  id: string
  source: string
  target: string
  event: BlueprintEvent
  guard?: string
}

export interface VisualBlueprint {
  id: string
  version: number
  agentSlug: string
  nodes: VisualNodeDef[]
  edges: VisualEdgeDef[]
}
