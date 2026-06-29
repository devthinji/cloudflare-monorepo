#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

errors=0

echo ""
echo "━━━ Validation — $(date '+%H:%M:%S') ━━━"
echo ""

# ── 1. Type check all packages ──────────────────────────────────────────────
echo "Type checking..."
TC_OUT=$(pnpm type-check 2>&1) && {
  pass "type-check — all clear"
} || {
  fail "type-check failed"
  echo "$TC_OUT" | grep -E "^[^ ]+\([0-9]+,[0-9]+\): error" | head -10
  ((errors++))
}

# ── 2. Uncommitted changes ──────────────────────────────────────────────────
if git rev-parse --git-dir > /dev/null 2>&1; then
  UNSTAGED=$(git diff --stat 2>/dev/null)
  STAGED=$(git diff --cached --stat 2>/dev/null)
  if [ -n "$UNSTAGED" ]; then
    warn "uncommitted (unstaged) changes:"
    echo "$UNSTAGED" | sed 's/^/    /'
  fi
  if [ -n "$STAGED" ]; then
    warn "uncommitted (staged) changes:"
    echo "$STAGED" | sed 's/^/    /'
  fi
  if [ -z "$UNSTAGED" ] && [ -z "$STAGED" ]; then
    pass "working tree clean"
  fi
fi

echo ""

if [ "$errors" -eq 0 ]; then
  echo -e "${GREEN}All checks passed.${NC}"
else
  echo -e "${RED}${errors} check(s) failed.${NC}"
fi
echo ""
exit "$errors"
