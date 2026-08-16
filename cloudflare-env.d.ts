/* Minimal Worker env typings — never include secret values. */
interface CloudflareEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_DB_URL?: string;
  SUPABASE_DB?: string;
  DATABASE_URL?: string;
  MIGRATE_TOKEN?: string;
  SITEFLIP_ALLOW_MIGRATE?: string;
  MOLLIE_API_KEY?: string;
  Mollie_api?: string;
  MOLLIE_WEBHOOK_URL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  AI_PROVIDER?: string;
  AI_FALLBACK_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ASSETS?: unknown;
  WORKER_SELF_REFERENCE?: { fetch: typeof fetch };
}
