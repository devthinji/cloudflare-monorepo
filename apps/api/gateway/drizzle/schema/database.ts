import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Agent: agents, conversations, messages, users ───────────────────────────

export const agents = sqliteTable('agents', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull().unique(),
  description:   text('description'),
  systemPrompt:  text('system_prompt').notNull(),
  toolsEnabled:  text('tools_enabled').notNull().default('[]'),
  modelProvider: text('model_provider').notNull().default('openrouter'),
  modelId:       text('model_id').notNull().default('openai/gpt-4o-mini'),
  channel:       text('channel').notNull().default('whatsapp'),
  channelConfig: text('channel_config'),
  apiKeys:       text('api_keys'),
  isActive:      integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:     text('created_at').notNull(),
  updatedAt:     text('updated_at').notNull(),
})

export const conversations = sqliteTable('conversations', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull(),
  agentSlug: text('agent_slug').notNull(),
  channel:   text('channel').notNull().default('whatsapp'),
  status:    text('status').notNull().default('active'),
  context:   text('context'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id:             text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role:           text('role').notNull(),
  content:        text('content').notNull(),
  toolCall:       text('tool_call'),
  tokensUsed:     integer('tokens_used').default(0),
  createdAt:      text('created_at').notNull(),
})

export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  phone:        text('phone'),
  channel:      text('channel').notNull().default('whatsapp'),
  agentSlug:    text('agent_slug'),
  isRegistered: integer('is_registered', { mode: 'boolean' }).notNull().default(false),
  isBlocked:    integer('is_blocked',    { mode: 'boolean' }).notNull().default(false),
  metadata:     text('metadata'),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
})

// ─── Docgen: templates, documents ─────────────────────────────────────────────

export const templates = sqliteTable('templates', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  slug:         text('slug').notNull().unique(),
  description:  text('description'),
  documentType: text('document_type').notNull(),
  tier:         text('tier'),
  agentSlugs:   text('agent_slugs').notNull().default('[]'),
  r2Key:        text('r2_key').notNull(),
  previewUrl:   text('preview_url'),
  fieldSchema:  text('field_schema').notNull().default('[]'),
  price:        real('price').notNull().default(0),
  currency:     text('currency').notNull().default('KES'),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(false),
  extractionStatus: text('extraction_status').notNull().default('pending'),
  extractionError:  text('extraction_error'),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
})

export const documents = sqliteTable('documents', {
  id:            text('id').primaryKey(),
  userId:        text('user_id').notNull(),
  agentSlug:     text('agent_slug').notNull(),
  templateId:    text('template_id'),
  type:          text('type').notNull(),
  title:         text('title').notNull(),
  fileUrl:       text('file_url'),
  fieldValues:   text('field_values'),
  transactionId: text('transaction_id'),
  createdAt:     text('created_at').notNull(),
})

// ─── Docgen: skus ──────────────────────────────────────────────────────────────

export const skus = sqliteTable('skus', {
  id:                text('id').primaryKey(),
  name:              text('name').notNull(),
  slug:              text('slug').notNull().unique(),
  description:       text('description'),
  agentSlug:         text('agent_slug').notNull(),
  templateType:      text('template_type').notNull(),
  fileKey:           text('file_key').notNull(),
  previewKey:        text('preview_key'),
  markdownPreview:   text('markdown_preview'),
  price:             real('price').notNull().default(0),
  currency:          text('currency').notNull().default('KES'),
  fieldSchema:       text('field_schema').notNull().default('[]'),
  conversationSteps: text('conversation_steps'),
  isActive:          integer('is_active', { mode: 'boolean' }).notNull().default(false),
  requiresReview:    integer('requires_review', { mode: 'boolean' }).notNull().default(true),
  version:           integer('version').notNull().default(1),
  createdAt:         text('created_at').notNull(),
  updatedAt:         text('updated_at').notNull(),
})

// ─── Payments: transactions ───────────────────────────────────────────────────

export const transactions = sqliteTable('transactions', {
  id:                 text('id').primaryKey(),
  userId:             text('user_id').notNull(),
  agentSlug:          text('agent_slug').notNull(),
  provider:           text('provider').notNull().default('mpesa'),
  amount:             real('amount').notNull(),
  currency:           text('currency').notNull().default('KES'),
  status:             text('status').notNull().default('pending'),
  merchantRequestId:  text('merchant_request_id'),
  checkoutRequestId:  text('checkout_request_id'),
  mpesaReceiptNumber: text('mpesa_receipt_number'),
  phoneNumber:        text('phone_number'),
  description:        text('description'),
  metadata:           text('metadata'),
  createdAt:          text('created_at').notNull(),
  updatedAt:          text('updated_at').notNull(),
})
