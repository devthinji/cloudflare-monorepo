#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  echo "Shutting down..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Free stale dev ports from a previous run ─────────────────────────────────
DEV_PORTS=(5173 8787 8790 8791 8793 9220 9221 9222 9224)
for port in "${DEV_PORTS[@]}"; do
  lsof -ti:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

# ─── Inject Doppler secrets into each worker's .dev.vars ──────────────────────
# Doppler exports all secrets as KEY=VALUE lines.
# We write them into .dev.vars so wrangler dev picks them up automatically.

inject_secrets() {
  local worker_dir="$1"
  echo "Injecting secrets → $worker_dir/.dev.vars"
  doppler secrets download --no-file --format env > "$worker_dir/.dev.vars"
}

inject_secrets "apps/api/gateway"
inject_secrets "apps/api/agent"
inject_secrets "apps/api/docgen"
inject_secrets "apps/api/payments"
inject_secrets "apps/web/aaf/whatsapp"

# ─── Validate before dev ──────────────────────────────────────────────────────
echo "Running validation checks..."
if ! bash "$ROOT/scripts/validate.sh"; then
  echo "ERROR: Validation failed. Fix errors before starting dev servers."
  exit 1
fi

# ─── Apply D1 migrations to local DB ──────────────────────────────────────────
echo "Applying D1 migrations from Gateway..."
for file in apps/api/gateway/drizzle/migration/*.sql; do
  [ -e "$file" ] || continue
  echo "Applying $(basename "$file")..."
  (cd apps/api/gateway && npx wrangler d1 execute platform-db --local \
    --file="drizzle/migration/$(basename "$file")" 2>/dev/null || true)
done
echo "Migrations applied."

# ─── Start services ────────────────────────────────────────────────────────────
echo "Starting: agent, docgen, gateway, whatsapp, dashboard..."

(cd apps/api/agent        && npx wrangler dev --port 8790 --ip localhost --inspector-port 9220) &
(cd apps/api/docgen       && npx wrangler dev --port 8791 --ip localhost --inspector-port 9221) &
(cd apps/api/gateway      && npx wrangler dev --port 8787 --ip localhost --inspector-port 9222) &
(cd apps/web/aaf/whatsapp && npx wrangler dev --port 8793 --ip localhost --inspector-port 9224) &
(cd apps/web/pages/dashboard && npx vite --port 5173 --host) &
(pnpm run db:studio) &

wait
