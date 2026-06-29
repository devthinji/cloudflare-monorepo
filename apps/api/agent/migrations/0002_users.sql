-- ─── Users table ──────────────────────────────────────────────────────────────
-- One row per unique channel user (WhatsApp number, Telegram ID, etc.)
-- id = channel-scoped user identifier (e.g. WhatsApp number without +)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  channel       TEXT NOT NULL DEFAULT 'whatsapp',
  agent_slug    TEXT,
  is_registered INTEGER NOT NULL DEFAULT 0,
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  metadata      TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_channel   ON users (channel);
CREATE INDEX IF NOT EXISTS idx_users_phone     ON users (phone);
