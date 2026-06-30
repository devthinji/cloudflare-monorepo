#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Workers that share platform-db — prefer gateway (migrations + seeds run here)
SEARCH_ROOTS=(
  "$ROOT/apps/api/gateway"
  "$ROOT/apps/api/agent"
  "$ROOT/apps/api/docgen"
  "$ROOT/apps/api/payments"
)

for app in "${SEARCH_ROOTS[@]}"; do
  dir="$app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  if [ -d "$dir" ]; then
    file=$(find "$dir" -maxdepth 1 -name '*.sqlite' -type f 2>/dev/null | head -1)
    if [ -n "$file" ]; then
      echo "$file"
      exit 0
    fi
  fi
done

# Bootstrap a local D1 file if none exists yet
echo "No local D1 database found — creating one via wrangler..." >&2
(cd "$ROOT/apps/api/agent" && npx wrangler d1 execute platform-db --local --command='SELECT 1' >/dev/null)

dir="$ROOT/apps/api/agent/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
file=$(find "$dir" -maxdepth 1 -name '*.sqlite' -type f 2>/dev/null | head -1)
if [ -n "$file" ]; then
  echo "$file"
  exit 0
fi

echo "ERROR: Could not locate local D1 SQLite file. Run 'pnpm dev' first." >&2
exit 1
