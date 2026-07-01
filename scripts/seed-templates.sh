#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCGEN_PORT="${1:-8791}"
BASE="http://localhost:$DOCGEN_PORT"
TEMPLATES_DIR="public/docx/templates"

# Source color scheme if available
if [ -f "$ROOT/scripts/color-scheme.sh" ]; then
  source "$ROOT/scripts/color-scheme.sh"
fi

I_STEP="${I_STEP:-▶}" I_PASS="${I_PASS:-✅}" I_ERROR="${I_ERROR:-❌}"
C_YELLOW="${C_YELLOW:-}" C_GREEN="${C_GREEN:-}" C_RED="${C_RED:-}" C_RESET="${C_RESET:-}"
cecho() { echo -e "$*"; }
cstep()  { cecho "\n${C_YELLOW}${I_STEP} $*${C_RESET}"; }
cpass()  { cecho "${C_GREEN}${I_PASS} $*${C_RESET}"; }
cerror() { cecho "${C_RED}${I_ERROR} $*${C_RESET}"; }

# Wait for docgen to be up
cstep "Waiting for docgen worker at $BASE..."
for i in $(seq 1 30); do
  if curl -sf "$BASE/health" > /dev/null 2>&1; then
    cpass "Docgen worker ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    cerror "Timed out waiting for docgen worker"
    exit 1
  fi
  sleep 1
done

# Upload templates
SEED_ENDPOINT="$BASE/api/v1/docgen/seed/template"
COUNT=0

for f in "$TEMPLATES_DIR"/*.docx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")
  KEY="templates/$BASENAME"
  cecho "  Uploading $BASENAME ..."

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$SEED_ENDPOINT" \
    -F "file=@$f" \
    -F "key=$KEY")

  if [ "$STATUS" = "201" ]; then
    COUNT=$((COUNT + 1))
    cpass "  $BASENAME → $KEY"
  else
    cerror "  $BASENAME failed (HTTP $STATUS)"
  fi
done

cpass "Seed complete: $COUNT template(s) uploaded to R2"
