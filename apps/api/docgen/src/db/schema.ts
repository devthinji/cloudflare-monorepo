import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Templates (legacy — superseded by skus) ─────────────────────────────────
// Still used by the legacy renderDoc endpoint. Do not use for new features.

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

// ─── SKUs — current product table ────────────────────────────────────────────
// Agent access is managed via the sku_agent_access junction table.

export const skus = sqliteTable('skus', {
  id:                text('id').primaryKey(),
  name:              text('name').notNull(),
  slug:              text('slug').notNull(),
  description:       text('description'),
  templateType:      text('template_type').notNull(),
  fileKey:           text('file_key').notNull(),
  previewKey:        text('preview_key'),
  markdownPreview:   text('markdown_preview'),
  price:             real('price').notNull().default(0),
  currency:          text('currency').notNull().default('KES'),
  fieldSchema:       text('field_schema').notNull().default('[]'),
  conversationSteps: text('conversation_steps'),
  isActive:          integer('is_active').notNull().default(0),
  requiresReview:    integer('requires_review').notNull().default(1),
  version:           integer('version').notNull().default(1),
  createdAt:         text('created_at').notNull(),
  updatedAt:         text('updated_at').notNull(),
})

// ─── SKU ↔ Agent access junction ─────────────────────────────────────────────

export const skuAgentAccess = sqliteTable('sku_agent_access', {
  id:         text('id').primaryKey(),
  skuId:      text('sku_id').notNull(),
  agentSlug:  text('agent_slug').notNull(),
  enabled:    integer('enabled').notNull().default(1),
  createdAt:  text('created_at').notNull(),
  updatedAt:  text('updated_at').notNull(),
})

// ─── Documents (generated files) ─────────────────────────────────────────────

export const documents = sqliteTable('documents', {
  id:             text('id').primaryKey(),
  userId:         text('user_id').notNull(),
  agentSlug:      text('agent_slug').notNull(),
  templateId:     text('template_id'),       // SKU id used
  type:           text('type').notNull(),
  title:          text('title').notNull(),
  fileUrl:        text('file_url'),          // R2 object key — use download endpoint
  fieldValues:    text('field_values'),      // JSON string — parsed on read
  transactionId:  text('transaction_id'),
  createdAt:      text('created_at').notNull(),
})
