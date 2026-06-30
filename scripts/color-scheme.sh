#!/usr/bin/env bash
# ─── Shared color scheme for bash scripts ────────────────────────────────────
# Source this file in any bash script that needs colored output matching the
# @repo/middleware logger in the TypeScript codebase.
#
# Usage:
#   source "$(dirname "$0")/color-scheme.sh"
#   cecho "${C_GATEWAY}gateway${C_RESET} ready"
#   cpass "all checks passed"
#
# Service colors match packages/middleware/src/service-colors.ts exactly.
# ──────────────────────────────────────────────────────────────────────────────

# ── Utilities ────────────────────────────────────────────────────────────────
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_DIM='\033[2m'

# ── Base colors ──────────────────────────────────────────────────────────────
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_BLUE='\033[0;34m'
C_MAGENTA='\033[0;35m'
C_CYAN='\033[0;36m'
C_WHITE='\033[0;37m'
C_GRAY='\033[0;90m'

# ── Service colors (sync with service-colors.ts) ────────────────────────────
# gateway   → magenta  #FF6AC1
# agent     → cyan     #56E1E9
# docgen    → yellow   #F4D35E
# whatsapp  → green    #5AF78E
# dashboard → blue     #5A9CF8
# default   → white    #FFFFFF
C_GATEWAY="${C_MAGENTA}"
C_AGENT="${C_CYAN}"
C_DOCGEN="${C_YELLOW}"
C_WHATSAPP="${C_GREEN}"
C_DASHBOARD="${C_BLUE}"
C_DEFAULT="${C_WHITE}"

# ── Level colors (sync with logger.ts) ───────────────────────────────────────
C_SUCCESS="${C_GREEN}"
C_INFO="${C_CYAN}"
C_STEP="${C_YELLOW}"
C_WARN="${C_YELLOW}"
C_ERROR="${C_RED}"
C_DEBUG="${C_GRAY}"

# ── Service icons (sync with service-colors.ts) ──────────────────────────────
I_GATEWAY='🛠️'
I_AGENT='🧠'
I_DOCGEN='📄'
I_WHATSAPP='💬'
I_DASHBOARD='🖥️'
I_DEFAULT='⚙️'

# ── Level icons (sync with logger.ts) ────────────────────────────────────────
I_SUCCESS='✅'
I_INFO='ℹ️'
I_STEP='→'
I_WARN='⚠️'
I_ERROR='❌'
I_DEBUG='🔍'

# ── Helper functions ─────────────────────────────────────────────────────────

# Print with color, auto-appends reset
cecho() { echo -e "$*${C_RESET}"; }

# Print a tagged service line: "icon [TAG] message"
# Usage: cservice <color> <icon> <tag> <message>
cservice() {
  local color="$1" icon="$2" tag="$3" msg="$4"
  local padded=$(printf "%-7s" "$tag")
  cecho "${color}${icon} [${padded}]${C_RESET} ${msg}"
}

# Level helpers — wrap message with level icon
cpass()  { cecho "  ${C_GREEN}${I_SUCCESS}${C_RESET} $1"; }
cfail()  { cecho "  ${C_RED}${I_ERROR}${C_RESET} $1"; }
cwarn()  { cecho "  ${C_YELLOW}${I_WARN}${C_RESET} $1"; }
cinfo()  { cecho "  ${C_CYAN}${I_INFO}${C_RESET} $1"; }
cstep()  { cecho "  ${C_YELLOW}${I_STEP}${C_RESET} $1"; }
cerror() { cecho "  ${C_RED}${I_ERROR}${C_RESET} $1"; }
cdebug() { cecho "  ${C_GRAY}${I_DEBUG}${C_RESET} $1"; }
