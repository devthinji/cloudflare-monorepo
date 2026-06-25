import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Templates (SKUs) ─────────────────────────────────────────────────────────

export const templates = sqliteTable('templates', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  slug:         text('slug').notNull().unique(),
  description:  text('description'),           // AI-generated visual description
  documentType: text('document_type').notNull(), // cv, letter, nda, minutes, gift_card, etc.
  tier:         text('tier'),                  // simple, advanced, pro (nullable)
  agentSlugs:   text('agent_slugs').notNull().default('[]'), // JSON string[]
  r2Key:        text('r2_key').notNull(),      // path to .docx in R2
  previewUrl:   text('preview_url'),           // R2 public URL of first-page image
  fieldSchema:  text('field_schema').notNull().default('[]'), // JSON FieldSchema[]
  price:        real('price').notNull().default(0),
  currency:     text('currency').notNull().default('KES'),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(false), // inactive until extraction done
  extractionStatus: text('extraction_status').notNull().default('pending'), // pending|processing|done|failed
  extractionError:  text('extraction_error'),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
})

// ─── Documents (generated files) ─────────────────────────────────────────────

export const documents = sqliteTable('documents', {
  id:             text('id').primaryKey(),
  userId:         text('user_id').notNull(),
  agentSlug:      text('agent_slug').notNull(),
  templateId:     text('template_id'),         // which SKU was used
  type:           text('type').notNull(),
  title:          text('title').notNull(),
  fileUrl:        text('file_url'),
  fieldValues:    text('field_values'),         // JSON — the collected data
  transactionId:  text('transaction_id'),       // linked payment
  createdAt:      text('created_at').notNull(),
})
