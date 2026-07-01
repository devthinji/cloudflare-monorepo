#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CRED_FILE="$ROOT/.test-credentials.json"
AGENT_URL="http://localhost:8790/api/v1/agent/agents/seed-credentials"

if [ ! -f "$CRED_FILE" ]; then
  echo "  SKIP  no .test-credentials.json found (create from .test-credentials.example.json)"
  exit 0
fi

echo "  SEED  agent credentials from .test-credentials.json"

# Use jq to iterate over each top-level key (agent slug)
for slug in $(jq -r 'keys[]' "$CRED_FILE"); do
  payload=$(jq -c --arg slug "$slug" '{slug: $slug, apiKeys: .[$slug].apiKeys, channelConfig: .[$slug].channelConfig}' "$CRED_FILE")
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AGENT_URL" \
    -H "Content-Type: application/json" \
    -d "$payload")
  if [ "$status" = "200" ]; then
    echo "    OK   $slug"
  else
    echo "    FAIL $slug (HTTP $status)"
  fi
done
