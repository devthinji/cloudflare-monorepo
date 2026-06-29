import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const agents = sqliteTable('agents', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull().unique(),
  description:   text('description'),
  systemPrompt:  text('system_prompt').notNull(),
  toolsEnabled:  text('tools_enabled').notNull().default('[]'),
  modelProvider: text('model_provider').notNull().default('openrouter'),
  modelId:       text('model_id').notNull().default('llama-3.3-70b-versatile'),
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
