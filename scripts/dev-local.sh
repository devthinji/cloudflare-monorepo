#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Load color scheme ────────────────────────────────────────────────────────
source "$ROOT/scripts/color-scheme.sh"

cleanup() {
  cecho "\n${C_YELLOW}${I_STEP} Shutting down...${C_RESET}"
  jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
  wait 2>/dev/null
  cecho "${C_RED}${I_ERROR} stopped${C_RESET}"
}
trap cleanup EXIT
trap 'exit 0' SIGINT SIGTERM

# ─── Kill stale processes ──────────────────────────────────────────────────────

DEV_PORTS=(5173 8787 8790 8791 8793 9220 9221 9222 9224)
for port in "${DEV_PORTS[@]}"; do
  lsof -ti:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

cecho "\n${C_BOLD}${C_MAGENTA}━━━ Dev Environment — $(date '+%H:%M') ━━━${C_RESET}\n"

# ─── Ensure .dev.vars exist ────────────────────────────────────────────────────

cstep "Setting up .dev.vars..."
bash "$ROOT/scripts/setup-dev.sh"

# ─── Validate ──────────────────────────────────────────────────────────────────

cstep "Running validation..."
if ! bash "$ROOT/scripts/validate.sh"; then
  cerror "Validation failed."
  exit 1
fi

# ─── Run D1 migrations + seed (ALL workers) ──────────────────────────────────

MIGRATION_FILE="apps/api/gateway/drizzle/migration/0000_init.sql"
SEED_FILE="apps/api/gateway/drizzle/seed/dev.sql"
WORKERS=(gateway agent docgen payments)

cstep "Applying D1 migrations..."
for w in "${WORKERS[@]}"; do
  npx wrangler d1 execute platform-db --local \
    --file="$MIGRATION_FILE" \
    --config="apps/api/$w/wrangler.toml" > /dev/null 2>&1 || true
done
cpass "Migrations applied"

cstep "Seeding D1 databases..."
for w in "${WORKERS[@]}"; do
  npx wrangler d1 execute platform-db --local \
    --file="$SEED_FILE" \
    --config="apps/api/$w/wrangler.toml" > /dev/null 2>&1 || true
done
cpass "Seed data applied"

# ─── Start workers ─────────────────────────────────────────────────────────────

cinfo "Starting workers..."

wrun() {
  local dir="$1" port="$2" insp="$3"
  (cd "$dir" && exec npx wrangler dev --port "$port" --ip localhost --inspector-port "$insp") &
}

wrun apps/api/agent        8790 9220
wrun apps/api/docgen       8791 9221
wrun apps/api/gateway      8787 9222
wrun apps/web/aaf/whatsapp 8793 9224
(cd apps/web/pages/dashboard && npx vite --port 5173 --host) &
(pnpm run db:studio) &

# ─── Seed templates to local R2 ────────────────────────────────────────────────

sleep 2
bash "$ROOT/scripts/seed-templates.sh" 2>/dev/null &
cpass "Template seed started"

# ─── Pinned services header ────────────────────────────────────────────────────

cecho ""
cecho "${C_GATEWAY}${I_GATEWAY} [GATEWAY]${C_RESET}  :8787  ${C_DIM}http://localhost:8787/health${C_RESET}"
cecho "${C_AGENT}${I_AGENT} [AGENTS] ${C_RESET}  :8790  ${C_DIM}http://localhost:8790/health${C_RESET}"
cecho "${C_DOCGEN}${I_DOCGEN} [DOCGEN] ${C_RESET}  :8791  ${C_DIM}http://localhost:8791/health${C_RESET}"
cecho "${C_WHATSAPP}${I_WHATSAPP} [WA]${C_RESET}     :8793  ${C_DIM}http://localhost:8793/health${C_RESET}"
cecho "${C_DASHBOARD}${I_DASHBOARD} [DASH]${C_RESET}    :5173  ${C_DIM}http://localhost:5173${C_RESET}"
cecho ""

wait
