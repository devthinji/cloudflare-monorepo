#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Load color scheme ────────────────────────────────────────────────────────
source "$ROOT/scripts/color-scheme.sh"

errors=0

cecho "\n${C_BOLD}${C_MAGENTA}━━━ Validation — $(date '+%H:%M:%S') ━━━${C_RESET}\n"

# ── 1. Type check all packages ──────────────────────────────────────────────
cstep "Type checking..."
TC_OUT=$(pnpm type-check 2>&1) && {
  cpass "type-check — all clear"
} || {
  cfail "type-check failed"
  echo "$TC_OUT" | grep -E "^[^ ]+\([0-9]+,[0-9]+\): error" | head -10
  ((errors++))
}

# ── 2. Uncommitted changes ──────────────────────────────────────────────────
if git rev-parse --git-dir > /dev/null 2>&1; then
  UNSTAGED=$(git diff --stat 2>/dev/null)
  STAGED=$(git diff --cached --stat 2>/dev/null)
  if [ -n "$UNSTAGED" ]; then
    cwarn "uncommitted (unstaged) changes:"
    echo "$UNSTAGED" | sed 's/^/    /'
  fi
  if [ -n "$STAGED" ]; then
    cwarn "uncommitted (staged) changes:"
    echo "$STAGED" | sed 's/^/    /'
  fi
  if [ -z "$UNSTAGED" ] && [ -z "$STAGED" ]; then
    cpass "working tree clean"
  fi
fi

cecho ""

if [ "$errors" -eq 0 ]; then
  cpass "All checks passed."
else
  cerror "${errors} check(s) failed."
fi
cecho ""
exit "$errors"
