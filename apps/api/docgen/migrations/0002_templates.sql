-- ─── Templates (SKUs) ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT,
  document_type     TEXT NOT NULL,
  tier              TEXT,
  agent_slugs       TEXT NOT NULL DEFAULT '[]',
  r2_key            TEXT NOT NULL,
  preview_url       TEXT,
  field_schema      TEXT NOT NULL DEFAULT '[]',
  price             REAL NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'KES',
  is_active         INTEGER NOT NULL DEFAULT 0,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

ALTER TABLE documents ADD COLUMN template_id     TEXT;
ALTER TABLE documents ADD COLUMN field_values    TEXT;
ALTER TABLE documents ADD COLUMN transaction_id  TEXT;
