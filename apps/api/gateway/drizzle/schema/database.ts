import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Blueprints: conversation flow definitions ────────────────────────────────

export const blueprints = sqliteTable('blueprints', {
  id:        text('id').primaryKey(),
  agentSlug: text('agent_slug').notNull(),
  version:   integer('version').notNull(),
  name:      text('name').notNull(),
  content:   text('content').notNull(), // JSON: VisualBlueprint
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── Agent: agents, conversations, messages, customers ───────────────────────

export const agents = sqliteTable('agents', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull().unique(),
  description:   text('description'),
  systemPrompt:  text('system_prompt').notNull(),
  toolsEnabled:  text('tools_enabled').notNull().default('[]'),
  modelProvider: text('model_provider').notNull().default('openrouter'),
  modelId:       text('model_id').notNull().default('meta-llama/llama-3.1-8b-instruct:free'),
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

export const customers = sqliteTable('customers', {
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

// ─── Docgen: documents ────────────────────────────────────────────────────────

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

// ─── Docgen: sku-agent access (junction table) ──────────────────────────────────

export const skuAgentAccess = sqliteTable('sku_agent_access', {
  id:        text('id').primaryKey(),
  skuId:     text('sku_id').notNull(),
  agentSlug: text('agent_slug').notNull(),
  enabled:   integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
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

// ─── Docgen: automation pipelines (make.com-style step chains) ───────────────

export const automationPipelines = sqliteTable('automation_pipelines', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  agentSlug: text('agent_slug').notNull().default('default'),
  steps:     text('steps').notNull().default('[]'), // JSON: AutomationStep[]
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const automationRuns = sqliteTable('automation_runs', {
  id:           text('id').primaryKey(),
  pipelineId:   text('pipeline_id').notNull(),
  status:       text('status').notNull().default('success'), // success | error
  input:        text('input'),
  output:       text('output'),
  logs:         text('logs'), // JSON: StepLogEntry[]
  createdAt:    text('created_at').notNull(),
})
