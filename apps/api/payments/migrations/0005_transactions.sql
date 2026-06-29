-- ─── M-Pesa transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL,
  agent_slug           TEXT NOT NULL,
  provider             TEXT NOT NULL DEFAULT 'mpesa',
  amount               REAL NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'KES',
  status               TEXT NOT NULL DEFAULT 'pending',
  merchant_request_id  TEXT,
  checkout_request_id  TEXT,
  mpesa_receipt_number TEXT,
  phone_number         TEXT,
  description          TEXT,
  metadata             TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
