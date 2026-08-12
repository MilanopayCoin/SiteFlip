#!/usr/bin/env bash
# Restore SITEFLIP Worker secrets after deploy without printing values.
# Usage: ./scripts/cf-put-secrets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .dev.vars ]]; then
  set -a
  # shellcheck disable=SC1091
  source .dev.vars
  set +a
fi

put_secret() {
  local name="$1"
  local value="${!1:-}"
  if [[ -z "$value" ]]; then
    echo "skip $name (not in env)"
    return 0
  fi
  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
  echo "restored $name"
}

# Normalize project-ref-only URLs
if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && "$NEXT_PUBLIC_SUPABASE_URL" =~ ^[a-z0-9]{15,32}$ ]]; then
  NEXT_PUBLIC_SUPABASE_URL="https://${NEXT_PUBLIC_SUPABASE_URL}.supabase.co"
  export NEXT_PUBLIC_SUPABASE_URL
fi

# Default AI provider when Groq key is present
if [[ -z "${AI_PROVIDER:-}" && -n "${GROQ_API_KEY:-}" ]]; then
  AI_PROVIDER=groq
  export AI_PROVIDER
fi

put_secret NEXT_PUBLIC_SUPABASE_URL
put_secret NEXT_PUBLIC_SUPABASE_ANON_KEY
put_secret SUPABASE_SERVICE_ROLE_KEY
put_secret GROQ_API_KEY
put_secret AI_PROVIDER
put_secret MOLLIE_API_KEY
put_secret MOLLIE_WEBHOOK_URL

echo "Current Worker secrets:"
npx wrangler secret list
