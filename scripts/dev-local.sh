#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Free stale dev ports ─────────────────────────────────────────────────────
DEV_PORTS=(5173 8787 8790 8791 8793 9220 9221 9222 9224)
for port in "${DEV_PORTS[@]}"; do
  lsof -ti:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

# ─── Inject Doppler secrets ───────────────────────────────────────────────────
echo "━━━ Dev Environment — $(date '+%H:%M') ━━━"
echo ""
doppler secrets download --no-file --format env > apps/api/gateway/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/agent/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/docgen/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/payments/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/web/aaf/whatsapp/.dev.vars 2>/dev/null

# ─── Validate before starting ─────────────────────────────────────────────────
if ! bash "$ROOT/scripts/validate.sh"; then
  echo "ERROR: Validation failed."
  exit 1
fi

# ─── Apply D1 migrations (silent — tables already exist on re-run, harmless) ───
for file in apps/api/gateway/drizzle/migration/*.sql; do
  [ -e "$file" ] || continue
  (cd apps/api/gateway && npx wrangler d1 execute platform-db --local \
    --file="drizzle/migration/$(basename "$file")" > /dev/null 2>&1) || true
done

# ─── Start services — filter wrangler noise, keep colored logs + errors ──────
echo "Starting workers..."
echo ""

# Filter: pass through ANSI-colored lines (our requestLogger) + errors; drop wrangler warnings
wr_filt() { grep --line-buffered -E $'(\x1b\\[|ERROR|error)' | grep -v 'out-of-date\|Workers AI'; }

(cd apps/api/agent        && npx wrangler dev --port 8790 --ip localhost --inspector-port 9220 2>&1 | wr_filt) &
(cd apps/api/docgen       && npx wrangler dev --port 8791 --ip localhost --inspector-port 9221 2>&1 | wr_filt) &
(cd apps/api/gateway      && npx wrangler dev --port 8787 --ip localhost --inspector-port 9222 2>&1 | wr_filt) &
(cd apps/web/aaf/whatsapp && npx wrangler dev --port 8793 --ip localhost --inspector-port 9224 2>&1 | wr_filt) &
(cd apps/web/pages/dashboard && npx vite --port 5173 --host 2>&1 | grep -v "deprecated\|MODULE_TYPELESS\|postcss") &
(pnpm run db:studio 2>&1 | grep -v "Beta\|Drizzle Studio is") &

# ─── Wait for workers to be ready (cache health status; avoid re-curling later) ──
declare -A HEALTH
for i in $(seq 1 20); do
  sleep 1
  all_ok=true
  for port in 8787 8790 8791 8793; do
    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
      HEALTH[$port]=1
    else
      HEALTH[$port]=0
      all_ok=false
    fi
  done
  $all_ok && break
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  %-16s %-5s %-11s %s\n" "Service" "Port" "Status" "Health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for svc in "gateway:8787" "agent:8790" "docgen:8791" "whatsapp:8793"; do
  name="${svc%%:*}"
  port="${svc##*:}"
  url="http://localhost:$port/health"
  if [ "${HEALTH[$port]}" = "1" ]; then
    printf "  \e[32m🟢\e[0m %-16s %-5s %-11s \e]8;;%s\e\\%s\e]8;;\e\\\n" "$name" "$port" "Running" "$url" "$url"
  else
    printf "  \e[31m🔴\e[0m %-16s %-5s Waiting...  %s\n" "$name" "$port" "$url"
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Dashboard → http://localhost:5173"
echo "  Studio    → https://local.drizzle.studio"
echo ""

wait
