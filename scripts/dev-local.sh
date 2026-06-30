#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Temp log buffer — workers write here before scroll view starts ─────
LOG_BUF=$(mktemp /tmp/dev-logbuf-XXXXXX)

cleanup() {
  printf "\x1b[?1049l" 2>/dev/null || true
  printf "\x1b[r" 2>/dev/null || true
  rm -f "$LOG_BUF" 2>/dev/null || true
  echo ""
  echo "Shutting down..."
  jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' SIGINT SIGTERM

# ─── Free stale dev ports ───────────────────────────────────────────────
DEV_PORTS=(5173 8787 8790 8791 8793 9220 9221 9222 9224)
for port in "${DEV_PORTS[@]}"; do
  lsof -ti:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

# ─── Inject Doppler secrets ─────────────────────────────────────────────
echo "━━━ Dev Environment — $(date '+%H:%M') ━━━"
echo ""
doppler secrets download --no-file --format env > apps/api/gateway/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/agent/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/docgen/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/api/payments/.dev.vars 2>/dev/null
doppler secrets download --no-file --format env > apps/web/aaf/whatsapp/.dev.vars 2>/dev/null

# ─── Validate before starting ────────────────────────────────────────────
if ! bash "$ROOT/scripts/validate.sh"; then
  echo "ERROR: Validation failed."
  exit 1
fi

# ─── Apply D1 migrations (silent — tables already exist on re-run) ────
for file in apps/api/gateway/drizzle/migration/*.sql; do
  [ -e "$file" ] || continue
  (cd apps/api/gateway && npx wrangler d1 execute platform-db --local \
    --file="drizzle/migration/$(basename "$file")" > /dev/null 2>&1) || true
done

# ─── Start services (filtered output → log buffer) ──────────────────────
echo "Starting workers..."
echo ""

# Run a worker behind a PTY (script -c) so Node.js keeps line-buffered
# output. Strip cursor-movement sequences ([7A, [0J, etc.) that would
# interfere with the scroll region.  Keep only our requestLogger lines
# (ANSI dim + timestamp) and ERROR messages.
wrun() {
  local dir="$1" port="$2" insp="$3"
  (cd "$dir" && script -q -c "npx wrangler dev --port $port --ip localhost --inspector-port $insp" /dev/null 2>&1 \
    | tr -d '\r' \
    | sed -u $'s/\x1b\\[[0-9;]*[A-Ja-j]//g' \
    | grep --line-buffered -E $'(\x1b\\[2m[0-9]{2}:[0-9]{2}:[0-9]{2}|ERROR)') >> "$LOG_BUF" &
}

wrun apps/api/agent        8790 9220
wrun apps/api/docgen       8791 9221
wrun apps/api/gateway      8787 9222
wrun apps/web/aaf/whatsapp 8793 9224
(cd apps/web/pages/dashboard && npx vite --port 5173 --host 2>&1 | grep -v "deprecated\|MODULE_TYPELESS\|postcss") &
(pnpm run db:studio 2>&1 | grep -v "Beta\|Drizzle Studio is") &

# ─── Wait for workers to be ready ───────────────────────────────────────
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

# ─── Alternate screen: fixed header + scroll region for logs ────────────
printf "\x1b[?1049h"  # enter alternate screen
printf "\x1b[2J"      # clear

# Header with OSC-8 clickable hyperlinks (11 lines; logs scroll from line 12)
echo ""
echo "  ─── Services ───────────────────────────────────────────────────────"
echo ""
echo -e "    \e[32m🟢\e[0m  gateway:8787    \u2192  \e]8;;http://localhost:8787/health\e\\http://localhost:8787/health\e]8;;\e\\"
echo -e "    \e[32m🟢\e[0m  agent:8790      \u2192  \e]8;;http://localhost:8790/health\e\\http://localhost:8790/health\e]8;;\e\\"
echo -e "    \e[32m🟢\e[0m  docgen:8791     \u2192  \e]8;;http://localhost:8791/health\e\\http://localhost:8791/health\e]8;;\e\\"
echo -e "    \e[32m🟢\e[0m  whatsapp:8793   \u2192  \e]8;;http://localhost:8793/health\e\\http://localhost:8793/health\e]8;;\e\\"
echo "    📊  Dashboard       →  http://localhost:5173"
echo ""
echo "  ────────────────────────────────────────────────────────────────────"
echo ""

# Set scroll region starting at line 12, move cursor there
printf "\x1b[12;r"
printf "\x1b[12;1H"

# Replay buffered logs then tail live
tail -f -n +1 "$LOG_BUF" &

wait
