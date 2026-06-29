-- ─── Agent Worker DB — initial schema ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  system_prompt   TEXT NOT NULL,
  tools_enabled   TEXT NOT NULL DEFAULT '[]',
  model_provider  TEXT NOT NULL DEFAULT 'groq',
  model_id        TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  channel         TEXT NOT NULL DEFAULT 'whatsapp',
  channel_config  TEXT,
  api_keys        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  agent_slug  TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'whatsapp',
  status      TEXT NOT NULL DEFAULT 'active',
  context     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id    ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_slug ON conversations (agent_slug);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  tool_call       TEXT,
  tokens_used     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
