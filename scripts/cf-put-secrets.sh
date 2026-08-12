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

need=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY)
for k in "${need[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    echo "Missing $k in environment or .dev.vars" >&2
    exit 1
  fi
done

# Normalize project-ref-only URLs
if [[ "$NEXT_PUBLIC_SUPABASE_URL" =~ ^[a-z0-9]{15,32}$ ]]; then
  NEXT_PUBLIC_SUPABASE_URL="https://${NEXT_PUBLIC_SUPABASE_URL}.supabase.co"
fi

printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL >/dev/null
printf '%s' "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY >/dev/null

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY >/dev/null
  echo "Restored URL, anon, and service role secrets."
else
  echo "Restored URL and anon secrets. Service role left unchanged (already on Worker)."
fi

npx wrangler secret list
