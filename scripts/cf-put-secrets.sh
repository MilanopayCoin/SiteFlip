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
put_secret SUPABASE_DB_URL
# Alternate name used on some Worker dashboards
if [[ -z "${SUPABASE_DB_URL:-}" && -n "${SUPABASE_DB:-}" ]]; then
  printf '%s' "$SUPABASE_DB" | npx wrangler secret put "SUPABASE_DB_URL" >/dev/null
  echo "restored SUPABASE_DB_URL (from SUPABASE_DB)"
fi
put_secret SUPABASE_DB
put_secret MIGRATE_TOKEN
put_secret SITEFLIP_ALLOW_MIGRATE
put_secret GROQ_API_KEY
put_secret GROQ_MODEL
put_secret AI_PROVIDER
put_secret MOLLIE_API_KEY
put_secret MOLLIE_WEBHOOK_URL
put_secret FAL_KEY
put_secret FAL_MODEL

# If only legacy name is present in env, also restore canonical binding
if [[ -z "${MOLLIE_API_KEY:-}" && -n "${Mollie_api:-}" ]]; then
  printf '%s' "$Mollie_api" | npx wrangler secret put "MOLLIE_API_KEY" >/dev/null
  echo "restored MOLLIE_API_KEY (from Mollie_api)"
fi

echo "Current Worker secrets:"
npx wrangler secret list
