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

/** Node categories mirrored from the palette: Basic, Message, Execute. */
export type NodeKind = 'stage' | 'transition' | 'message' | 'execute'
export type MessageType = 'text' | 'image'

export interface VisualNodeDef {
  id: string
  /** Defaults to 'stage' when absent — keeps old blueprints (pre node-kinds) valid. */
  kind?: NodeKind
  // — stage (Basic) —
  stage?: StageType
  label: string
  description?: string
  subStages?: string[]
  // — transition (Basic) —
  condition?: string
  // — message (Message) —
  messageType?: MessageType
  content?: string
  mediaUrl?: string
  // — execute (Execute) —
  action?: string
  params?: string
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
