// ─── WhatsApp Cloud API v20.0 — full type definitions ────────────────────────
//
// Covers: outgoing messages (text, interactive, media, document, location,
// contacts, template, reaction) and incoming webhook payloads (messages,
// status updates, interactive replies).
//
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

// ─── Outgoing message types ─────────────────────────────────────────────────

export type MessageType =
  | 'text'
  | 'interactive'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'template'
  | 'reaction'

// ─── Base message ───────────────────────────────────────────────────────────

export interface BaseMessage {
  messaging_product: 'whatsapp'
  recipient_type?:   'individual' | 'group'
  to:                string
  type:              MessageType
}

// ─── Text ───────────────────────────────────────────────────────────────────

export interface TextMessage extends BaseMessage {
  type: 'text'
  text: {
    body:        string
    preview_url?: boolean
  }
}

// ─── Interactive ────────────────────────────────────────────────────────────

export type InteractiveType =
  | 'button'            // Reply buttons (up to 3)
  | 'list'              // List of options (single-select)
  | 'cta_url'           // Call-to-action URL button
  | 'flow'              // Interactive form flow
  | 'product'           // Single product
  | 'catalog_message'   // Multi-product catalog

export interface InteractiveMessage extends BaseMessage {
  type: 'interactive'
  interactive: {
    type?:   InteractiveType
    header?: InteractiveHeader
    body?:   InteractiveBody
    footer?: InteractiveFooter
    action:  InteractiveAction
  }
}

export type InteractiveHeader =
  | { type: 'text';    text: string }
  | { type: 'document'; document: { id?: string; link?: string; filename?: string } }
  | { type: 'image';   image: { id?: string; link?: string } }
  | { type: 'video';   video: { id?: string; link?: string } }

export interface InteractiveBody {
  text: string
}

export interface InteractiveFooter {
  text: string
}

export type InteractiveAction =
  | InteractiveButtonAction
  | InteractiveListAction
  | InteractiveCTAUrlAction
  | InteractiveFlowAction
  | InteractiveProductAction
  | InteractiveCatalogAction

// ── Buttons ─────────────────────────────────────────────────────────────────

export interface InteractiveButtonAction {
  /** Omit for button type */
  button?: string
  buttons: ButtonReply[]
}

export interface ButtonReply {
  type:  'reply'
  reply: {
    title: string       // max 20 chars
    id:    string       // max 256 chars, returned in webhook
  }
}

// ── List ────────────────────────────────────────────────────────────────────

export interface InteractiveListAction {
  button: string        // Button text that opens the list (max 20 chars)
  sections: ListSection[]
}

export interface ListSection {
  title?: string        // max 24 chars
  rows:    ListRow[]
}

export interface ListRow {
  id:          string   // max 200 chars, returned in webhook
  title:       string   // max 24 chars
  description?: string  // max 72 chars
}

// ── CTA URL ─────────────────────────────────────────────────────────────────

export interface InteractiveCTAUrlAction {
  name: 'cta_url'
  parameters: {
    display_text: string
    url:          string
  }
}

// ── Flow ────────────────────────────────────────────────────────────────────

export interface InteractiveFlowAction {
  name: 'flow'
  parameters: {
    flow_message_version: string
    flow_token:           string
    flow_id:              string
    flow_cta:             string
    flow_action:          'navigate' | 'data_exchange'
    flow_action_payload?: Record<string, unknown>
  }
}

// ── Product ─────────────────────────────────────────────────────────────────

export interface InteractiveProductAction {
  /** Set to "product" */
  catalog_id: string
  product_retailer_id: string
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export interface InteractiveCatalogAction {
  /** Set to "catalog_message" */
  catalog_id: string
  sections: CatalogSection[]
}

export interface CatalogSection {
  title?:               string
  product_retailer_ids: string[]
}

// ─── Media messages (image / audio / video / document / sticker) ────────────

export interface MediaMessage extends BaseMessage {
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker'
  [key: string]: unknown  // one of: image, audio, video, document, sticker
}

export interface ImagePayload {
  id?:   string
  link?: string
  caption?: string
}

export interface AudioPayload {
  id?:  string
  link?: string
}

export interface VideoPayload {
  id?:   string
  link?: string
  caption?: string
}

export interface DocumentPayload {
  id?:       string
  link?:     string
  caption?:  string
  filename?: string
}

export interface StickerPayload {
  id?:  string
  link?: string
}

// ─── Location ───────────────────────────────────────────────────────────────

export interface LocationMessage extends BaseMessage {
  type: 'location'
  location: {
    longitude: number
    latitude:  number
    name?:     string
    address?:  string
  }
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export interface ContactsMessage extends BaseMessage {
  type: 'contacts'
  contacts: ContactPayload[]
}

export interface ContactPayload {
  addresses?:   ContactAddress[]
  birthday?:    string      // YYYY-MM-DD
  emails?:      { email?: string; type?: string }[]
  name:         ContactName
  org?:         { company?: string; department?: string; title?: string }
  phones?:      { phone?: string; type?: string; wa_id?: string }[]
  urls?:        { url?: string; type?: string }[]
}

export interface ContactAddress {
  street?:     string
  city?:       string
  state?:      string
  zip?:        string
  country?:    string
  country_code?: string
  type?:       string     // HOME | WORK
}

export interface ContactName {
  formatted_name:      string
  first_name?:         string
  last_name?:          string
  middle_name?:        string
  suffix?:             string
  prefix?:             string
}

// ─── Template ───────────────────────────────────────────────────────────────

export interface TemplateMessage extends BaseMessage {
  type: 'template'
  template: {
    name:       string
    language?:  { code: string; policy?: 'deterministic' }
    components?: TemplateComponent[]
  }
}

export interface TemplateComponent {
  type:     'header' | 'body' | 'button'
  parameters?: TemplateParameter[]
  index?:    number     // for button type (0-4)
  sub_type?: string     // for button type: 'quick_reply' | 'url' | 'catalog'
}

export type TemplateParameter =
  | { type: 'text';     text: string }
  | { type: 'currency'; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: 'date_time'; date_time: { fallback_value: string } }
  | { type: 'image';    image: { id?: string; link?: string } }
  | { type: 'document'; document: { id?: string; link?: string; filename?: string } }
  | { type: 'video';    video: { id?: string; link?: string } }
  | { type: 'payload';  payload: string }       // for button quick_reply

// ─── Reaction ───────────────────────────────────────────────────────────────

export interface ReactionMessage extends BaseMessage {
  type: 'reaction'
  reaction: {
    message_id: string
    emoji:      string    // empty string to remove reaction
  }
}

// ─── Outgoing message union ────────────────────────────────────────────────

export type OutgoingMessage =
  | TextMessage
  | InteractiveMessage
  | MediaMessage
  | LocationMessage
  | ContactsMessage
  | TemplateMessage
  | ReactionMessage

// ═══════════════════════════════════════════════════════════════════════════
// Incoming webhook types
// ═══════════════════════════════════════════════════════════════════════════

// ─── Webhook payload ───────────────────────────────────────────────────────

export interface WaWebhookPayload {
  object: 'whatsapp_business_account'
  entry: WaWebhookEntry[]
}

export interface WaWebhookEntry {
  id:      string
  changes: WaWebhookChange[]
}

export interface WaWebhookChange {
  field: 'messages'
  value: {
    messaging_product: 'whatsapp'
    metadata: {
      display_phone_number: string
      phone_number_id:      string
    }
    contacts?: WaContact[]
    messages?: WaIncomingMessage[]
    statuses?: WaStatusUpdate[]
  }
}

// ─── Contact ────────────────────────────────────────────────────────────────

export interface WaContact {
  profile: { name: string }
  wa_id:   string
}

// ─── Incoming message ──────────────────────────────────────────────────────

export type WaIncomingMessageType =
  | 'text'
  | 'interactive'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'order'
  | 'button'       // legacy
  | 'system'
  | 'unknown'

export interface WaIncomingMessage {
  from:      string
  id:        string
  timestamp: string
  type:      WaIncomingMessageType
  text?:            WaTextContent
  interactive?:     WaInteractiveContent
  image?:           WaMediaContent
  audio?:           WaMediaContent
  video?:           WaMediaContent
  document?:        WaDocumentContent
  sticker?:         WaMediaContent
  location?:        WaLocationContent
  contacts?:        ContactPayload[]
  reaction?:        WaReactionContent
  order?:           WaOrderContent
  button?:          WaLegacyButtonContent
  system?:          WaSystemContent
  context?:         WaMessageContext
  referral?:        WaReferral
  identity?:        WaIdentity
  errors?:          WaError[]
}

// ─── Text content ──────────────────────────────────────────────────────────

export interface WaTextContent {
  body: string
}

// ─── Interactive content (button_reply / list_reply) ───────────────────────

export interface WaInteractiveContent {
  type:            'button_reply' | 'list_reply'
  button_reply?:   WaButtonReply
  list_reply?:     WaListReply
}

export interface WaButtonReply {
  id:    string
  title: string
}

export interface WaListReply {
  id:          string
  title:       string
  description?: string
}

// ─── Media content ─────────────────────────────────────────────────────────

export interface WaMediaContent {
  id?:        string
  mime_type?: string
  sha256?:    string
  caption?:   string
  filename?:  string
}

export interface WaDocumentContent extends WaMediaContent {
  filename?: string
}

// ─── Location ──────────────────────────────────────────────────────────────

export interface WaLocationContent {
  latitude:  number
  longitude: number
  name?:     string
  address?:  string
}

// ─── Reaction ──────────────────────────────────────────────────────────────

export interface WaReactionContent {
  message_id: string
  emoji:      string
}

// ─── Order ─────────────────────────────────────────────────────────────────

export interface WaOrderContent {
  catalog_id: string
  product_items: WaOrderProductItem[]
  text?: string
}

export interface WaOrderProductItem {
  product_retailer_id: string
  quantity:            number
  item_price?:         string
  currency?:           string
}

// ─── Legacy button ─────────────────────────────────────────────────────────

export interface WaLegacyButtonContent {
  payload: string
  text:    string
}

// ─── System ────────────────────────────────────────────────────────────────

export interface WaSystemContent {
  body: string
  identity: string
  new_wa_id?: string
  wa_id?:     string
  type:       'user_changed_number' | 'user_identity_change'
  customer?:  string
}

// ─── Context (reply to / quoted message) ───────────────────────────────────

export interface WaMessageContext {
  from:           string
  id:             string
  referred_product?: { catalog_id: string; product_retailer_id: string }
  forwarding_score?: number
}

// ─── Referral ──────────────────────────────────────────────────────────────

export interface WaReferral {
  source_url?:     string
  source_type:     'ad' | 'post' | 'search' | 'unknown'
  headline?:       string
  body?:           string
  media?:          WaMediaContent
  ctwa_cli_id?:    string
  ref?:            string
}

// ─── Identity ──────────────────────────────────────────────────────────────

export interface WaIdentity {
  ack_key:  string
  hashed?:  string
  created_timestamp: string
}

// ─── Error ─────────────────────────────────────────────────────────────────

export interface WaError {
  code:   number
  title:  string
  message?: string
  error_data?: { details: string }
}

// ─── Status updates ────────────────────────────────────────────────────────

export type WaStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export interface WaStatusUpdate {
  status:        WaStatus
  timestamp:     string
  recipient_id:  string
  conversation?: WaConversation
  pricing?:      WaPricing
  origin?:       { type: 'rest' | 'business_api' | 'unknown' }
  errors?:       WaError[]
  id?:           string
}

export interface WaConversation {
  id:        string
  expiration_timestamp?: string
  origin?:   { type: 'business' | 'user_initiated' | 'referral_conversion' | 'service' | 'unknown' }
}

export interface WaPricing {
  billable:       boolean
  pricing_model:  string
  category:       'referral_conversion' | 'business_initiated' | 'user_initiated' | 'service' | 'unknown'
}

// ═══════════════════════════════════════════════════════════════════════════
// Response types from Meta API
// ═══════════════════════════════════════════════════════════════════════════

export interface WaSendResponse {
  messaging_product: 'whatsapp'
  contacts: { input: string; wa_id: string }[]
  messages: { id: string }[]
}

export interface WaMediaUploadResponse {
  id: string
}

export interface WaMediaDownloadInfo {
  url:          string
  mime_type:    string
  sha256:       string
  file_size:    number
  id:           string
  messaging_product: 'whatsapp'
}

// ═══════════════════════════════════════════════════════════════════════════
// InteractionHint — channel-agnostic hint from gateway machine
// ═══════════════════════════════════════════════════════════════════════════

export interface InteractionHint {
  type: 'buttons' | 'list'
  buttons?:       { id: string; title: string }[]
  header?:        string
  body?:          string
  footer?:        string
  buttonLabel?:   string
  sections?:      { title?: string; rows: { id: string; title: string; description?: string }[] }[]
}

// ═══════════════════════════════════════════════════════════════════════════
// Builder helpers (type-safe factories)
// ═══════════════════════════════════════════════════════════════════════════

export function buildTextMessage(to: string, body: string, previewUrl = false): TextMessage {
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: previewUrl } }
}

export function buildButtonMessage(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  opts?: { header?: string; footer?: string }
): InteractiveMessage {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      ...(opts?.header ? { header: { type: 'text' as const, text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { buttons: buttons.map(b => ({ type: 'reply' as const, reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  }
}

export function buildListMessage(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[],
  opts?: { header?: string; footer?: string }
): InteractiveMessage {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      ...(opts?.header ? { header: { type: 'text' as const, text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { button: buttonLabel.slice(0, 20), sections: sections.map(s => ({ ...(s.title ? { title: s.title.slice(0, 24) } : {}), rows: s.rows.map(r => ({ id: r.id, title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) })) },
    },
  }
}

export function buildDocumentMessage(
  to: string,
  mediaId: string,
  opts?: { caption?: string; filename?: string }
): MediaMessage {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'document',
    document: { id: mediaId, ...(opts?.caption ? { caption: opts.caption } : {}), ...(opts?.filename ? { filename: opts.filename } : {}) },
  } as unknown as MediaMessage
}
