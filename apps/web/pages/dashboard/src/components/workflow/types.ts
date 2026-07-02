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

/**
 * Botpress-v12-style node action: nodes carry an ordered list of these,
 * run "onEnter", instead of actions living as separate draggable nodes.
 */
export type NodeActionType = 'say_text' | 'say_image' | 'execute_code'

export interface NodeAction {
  id: string
  type: NodeActionType
  content?: string     // say_text body, or say_image caption
  mediaUrl?: string     // say_image
  actionName?: string   // execute_code: action/function name
  params?: string       // execute_code: raw JSON params
}

export interface VisualNodeDef {
  id: string
  stage: StageType
  label: string
  description?: string
  subStages?: string[]
  /** Ordered actions run when the node is entered (Botpress v12's onEnter). */
  actions?: NodeAction[]
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
