-- ─── Documents table ──────────────────────────────────────────────────────────
-- One row per generated document — created after successful render + payment.

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  agent_slug      TEXT NOT NULL,
  template_id     TEXT,                   -- FK to skus.id
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  file_url        TEXT,                   -- R2 CDN URL or key
  field_values    TEXT,                   -- JSON collected answers
  transaction_id  TEXT,                   -- linked M-Pesa tx
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id    ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_agent_slug ON documents (agent_slug);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at);
