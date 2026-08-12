/**
 * Supabase env resolution for Node + Cloudflare Workers (OpenNext).
 * Never log secret values from this module.
 */

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

export type SupabaseServerEnv = SupabasePublicEnv & {
  serviceRoleKey: string | null;
};

function normalizeSupabaseUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/\/$/, "");
  if (!value) return null;

  // Full URL already
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value)) {
    return value.toLowerCase();
  }
  if (/^https:\/\/[a-z0-9.-]+/i.test(value)) {
    return value;
  }

  // Dashboard sometimes stores only the project ref
  if (/^[a-z0-9]{15,32}$/i.test(value)) {
    return `https://${value.toLowerCase()}.supabase.co`;
  }

  // Host without protocol
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(value)) {
    return `https://${value.toLowerCase()}`;
  }

  return null;
}

function readProcess(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Optionally merge Cloudflare Worker bindings into process.env.
 * OpenNext usually does this already; this is a safe fallback for server code.
 */
export async function ensureCloudflareEnv(): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    if (!env) return;
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_DB_URL",
      "MIGRATE_TOKEN",
      "SITEFLIP_ALLOW_MIGRATE",
      "MOLLIE_API_KEY",
      "Mollie_api", // legacy Worker secret name
      "MOLLIE_WEBHOOK_URL",
      "GROQ_API_KEY",
      "AI_PROVIDER",
      "AI_FALLBACK_PROVIDER",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "GROQ_MODEL",
    ]) {
      const val = env[key];
      if (typeof val === "string" && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
    // Normalize legacy Mollie secret binding → MOLLIE_API_KEY
    if (!process.env.MOLLIE_API_KEY?.trim()) {
      const legacy =
        (typeof env.Mollie_api === "string" && env.Mollie_api.trim()) ||
        process.env.Mollie_api?.trim();
      if (legacy) process.env.MOLLIE_API_KEY = legacy;
    }
  } catch {
    // Not running on Cloudflare / context unavailable — ignore
  }
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = normalizeSupabaseUrl(readProcess("NEXT_PUBLIC_SUPABASE_URL"));
  const anonKey = readProcess("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseServerEnv(): SupabaseServerEnv | null {
  const pub = getSupabasePublicEnv();
  if (!pub) return null;
  return {
    ...pub,
    serviceRoleKey: readProcess("SUPABASE_SERVICE_ROLE_KEY") ?? null,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

export function isSupabaseServiceConfigured(): boolean {
  const env = getSupabaseServerEnv();
  return Boolean(env?.serviceRoleKey);
}
