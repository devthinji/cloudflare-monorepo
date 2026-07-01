#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━ Setting up .dev.vars for local development ━━━"

EXAMPLE_FILES=$(find "$ROOT" -name '.dev.vars.example' -not -path '*/node_modules/*' -not -path '*/.git/*')

copied=0
skipped=0
for example in $EXAMPLE_FILES; do
  devvars="${example%.example}"
  if [ -f "$devvars" ]; then
    echo "  SKIP  ${devvars#$ROOT/}  (already exists)"
    skipped=$((skipped + 1))
  else
    cp "$example" "$devvars"
    echo "  COPY  ${example#$ROOT/}  →  ${devvars#$ROOT/}"
    copied=$((copied + 1))
  fi
done

echo ""
echo "Done: $copied created, $skipped skipped."
echo ""
echo "Next: open each .dev.vars and fill in real values."
echo "  Required: JWT_SECRET, OPENROUTER_API_KEY, DB_ENCRYPTION_KEY"
echo "  Required: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY"
echo "  Required: WHATSAPP_* (if using WhatsApp)"
echo ""
