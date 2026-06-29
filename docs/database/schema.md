# Database Schema — Minimal D1 Design

## Design Philosophy

> Simple tables. No over-engineering. Every table has a clear, single responsibility.
> We start with what Taji needs. Elim shares 80% of the same tables.

---

## Core Tables (Shared by all agents)

### `agents`
The heart of the platform. One row = one deployed agent.

```sql
CREATE TABLE agents (
  id              TEXT PRIMARY KEY,          -- ulid
  name            TEXT NOT NULL,             -- "Taji", "Elim"
  slug            TEXT NOT NULL UNIQUE,      -- "taji", "elim"
  description     TEXT,
  system_prompt   TEXT NOT NULL,             -- AI instructions
  tools_enabled   TEXT NOT NULL DEFAULT '[]',-- JSON array: ["docgen","memory"]
  model_provider  TEXT NOT NULL DEFAULT 'openrouter',
  model_id        TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  channel         TEXT NOT NULL DEFAULT 'whatsapp',
  channel_config  TEXT,                      -- encrypted JSON
  api_keys        TEXT,                      -- encrypted JSON
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### `users`
Anyone who interacts with any agent. Identified by phone number.

```sql
CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  phone           TEXT NOT NULL UNIQUE,      -- +254712345678
  name            TEXT,
  role            TEXT NOT NULL DEFAULT 'user', -- user | admin
  agent_slug      TEXT,                      -- which agent they use
  tenant_id       TEXT,                      -- for schools/orgs
  metadata        TEXT,                      -- JSON: grade, school, etc.
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### `conversations`
Every conversation session with an agent.

```sql
CREATE TABLE conversations (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  agent_slug      TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'whatsapp',
  status          TEXT NOT NULL DEFAULT 'active', -- active | closed
  context         TEXT,                      -- JSON: current doc being built
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### `messages`
Every message in every conversation.

```sql
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL,             -- user | assistant | tool
  content         TEXT NOT NULL,
  tool_call       TEXT,                      -- JSON if tool was used
  tokens_used     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL
);
```

### `documents`
Every document ever generated, for any user, by any agent.

```sql
CREATE TABLE documents (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  agent_slug      TEXT NOT NULL,
  type            TEXT NOT NULL,             -- cv | application_letter | exam | report
  title           TEXT NOT NULL,
  file_url        TEXT,                      -- R2 URL
  template_used   TEXT,
  metadata        TEXT,                      -- JSON: job_title, grade, strand, etc.
  created_at      TEXT NOT NULL
);
```

### `tenants`
Schools, companies, NGOs — organizations using the platform.

```sql
CREATE TABLE tenants (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,             -- school | company | ngo
  agent_slug      TEXT NOT NULL,
  contact_phone   TEXT,
  contact_email   TEXT,
  settings        TEXT,                      -- JSON
  created_at      TEXT NOT NULL
);
```

---

## Taji-Specific Data

Stored in `users.metadata` as JSON (no separate table needed at start):

```json
{
  "full_name": "John Kamau",
  "email": "john@email.com",
  "education": [...],
  "experience": [...],
  "skills": [...],
  "summary": "...",
  "last_cv_id": "doc_xyz"
}
```

---

## Elim-Specific Tables

### `student_sessions`
Tracks individual tutorship sessions for scoring and progress.

```sql
CREATE TABLE student_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  subject         TEXT NOT NULL,             -- Maths, English, Science
  strand          TEXT,                      -- CBC strand
  grade           TEXT NOT NULL,
  score           INTEGER,                   -- out of total
  total           INTEGER,
  weak_areas      TEXT,                      -- JSON array
  created_at      TEXT NOT NULL
);
```

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| ULID for all IDs | Sortable, URL-safe, no UUID collisions |
| JSON in metadata columns | Avoids premature schema complexity |
| One `documents` table for all doc types | Simple, agent-agnostic |
| Phone number as user identifier | Users auth via WhatsApp — no email/password |
| `agent_slug` on every table | Easy multi-agent queries, no joins needed |
| Start with 6 tables | Enough for Taji v1 + Elim v1. Add as needed. |

---

## What We Don't Have Yet (And Don't Need Yet)

- ❌ Payments/transactions table — add when M-Pesa integration starts
- ❌ Notifications table — use conversation messages for now
- ❌ Audit log — add when needed for compliance
- ❌ Separate profile tables — metadata JSON is enough for v1
