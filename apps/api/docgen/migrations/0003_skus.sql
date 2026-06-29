-- ─── SKUs table ───────────────────────────────────────────────────────────────
-- Each row is one sellable template / product.
-- The schema (JSON) drives the ConversationMachine field collection.
-- The conversationSteps (JSON) overrides default machine behavior if set.

CREATE TABLE IF NOT EXISTS skus (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,         -- e.g. 'professional-cv-v1'
  description         TEXT,                         -- AI-generated or admin-written
  agent_slug          TEXT NOT NULL,                -- 'taji' | 'elim'
  template_type       TEXT NOT NULL,                -- 'docx' | 'pdf' | 'canva' | 'image'
  file_key            TEXT NOT NULL,                -- R2 object key
  preview_key         TEXT,                         -- R2 key for PNG preview (optional)
  markdown_preview    TEXT,                         -- markdown text preview
  price               REAL NOT NULL DEFAULT 0,      -- KES
  currency            TEXT NOT NULL DEFAULT 'KES',
  field_schema        TEXT NOT NULL DEFAULT '[]',   -- JSON: FieldSchema[]
  conversation_steps  TEXT,                         -- JSON: override machine steps (optional)
  is_active           INTEGER NOT NULL DEFAULT 0,   -- 0=draft, 1=live
  requires_review     INTEGER NOT NULL DEFAULT 1,   -- 1 if AI-extracted, needs human review
  version             INTEGER NOT NULL DEFAULT 1,   -- increment on schema change
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skus_agent_slug  ON skus (agent_slug);
CREATE INDEX IF NOT EXISTS idx_skus_is_active   ON skus (is_active);
CREATE INDEX IF NOT EXISTS idx_skus_slug        ON skus (slug);
