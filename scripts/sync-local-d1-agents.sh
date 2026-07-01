#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

find_d1_sqlite() {
  local app="$1"
  local dir="$ROOT/$app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  if [ ! -d "$dir" ]; then
    return 1
  fi
  find "$dir" -maxdepth 1 -name '*.sqlite' -type f ! -name 'metadata.sqlite' 2>/dev/null | head -1
}

SOURCE_DB=$(find_d1_sqlite "apps/api/agent") || true
TARGET_DB=$(find_d1_sqlite "apps/web/aaf/whatsapp") || true

if [ -z "$SOURCE_DB" ] || [ -z "$TARGET_DB" ]; then
  echo "  SKIP  local D1 sync (agent or whatsapp database not found)"
  exit 0
fi

if [ "$SOURCE_DB" = "$TARGET_DB" ]; then
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "  SKIP  local D1 sync (sqlite3 not installed)"
  exit 0
fi

sqlite3 "$TARGET_DB" <<SQL
ATTACH DATABASE '$SOURCE_DB' AS src;
DELETE FROM agents;
INSERT INTO agents SELECT * FROM src.agents;
DETACH DATABASE src;
SQL

echo "  SYNC  agents table → whatsapp local D1"
