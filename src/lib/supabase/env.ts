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
 * Prefer non-empty Worker bindings over empty/stale process.env.
 * Never logs secret values.
 */
export async function ensureCloudflareEnv(): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as unknown as Record<string, unknown> | undefined;
    if (!env) return;

    const keys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_DB_URL",
      "SUPABASE_DB", // alternate Worker secret name
      "DATABASE_URL",
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
    ];

    for (const key of keys) {
      const val = env[key];
      if (typeof val === "string" && val.trim()) {
        // Prefer Worker secret binding when present
        process.env[key] = val.trim();
      }
    }

    // Case-insensitive fallback for DB URL secret names (dashboard typos)
    if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.SUPABASE_DB?.trim()) {
      for (const [k, v] of Object.entries(env)) {
        if (
          typeof v === "string" &&
          v.trim() &&
          /^supabase_db(_url)?$/i.test(k)
        ) {
          process.env.SUPABASE_DB = v.trim();
          break;
        }
      }
    }

    // Normalize alternate DB URL bindings → SUPABASE_DB_URL (never log value)
    if (!process.env.SUPABASE_DB_URL?.trim()) {
      const alt =
        process.env.SUPABASE_DB?.trim() ||
        process.env.DATABASE_URL?.trim() ||
        (typeof env.SUPABASE_DB === "string" && env.SUPABASE_DB.trim()) ||
        (typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim()) ||
        "";
      if (alt) process.env.SUPABASE_DB_URL = alt;
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

/** Non-secret presence probe for DB connection secrets (never returns values). */
export async function getDbSecretPresence(): Promise<{
  contextAvailable: boolean;
  bindingKeys: string[];
  supabaseDb: { present: boolean; length: number; type: string };
  supabaseDbUrl: { present: boolean; length: number; type: string };
  databaseUrl: { present: boolean; length: number; type: string };
}> {
  const describe = (v: unknown) => {
    if (typeof v === "string") {
      const t = v.trim();
      return { present: Boolean(t), length: t.length, type: "string" };
    }
    if (v == null) return { present: false, length: 0, type: v === null ? "null" : "undefined" };
    return { present: false, length: 0, type: typeof v };
  };

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const env = (ctx?.env || {}) as unknown as Record<string, unknown>;
    const bindingKeys = Object.keys(env)
      .filter((k) => /supabase|migrate|database|mollie|groq|ai_/i.test(k))
      .sort();
    return {
      contextAvailable: true,
      bindingKeys,
      supabaseDb: describe(env.SUPABASE_DB ?? process.env.SUPABASE_DB),
      supabaseDbUrl: describe(env.SUPABASE_DB_URL ?? process.env.SUPABASE_DB_URL),
      databaseUrl: describe(env.DATABASE_URL ?? process.env.DATABASE_URL),
    };
  } catch {
    return {
      contextAvailable: false,
      bindingKeys: [],
      supabaseDb: describe(process.env.SUPABASE_DB),
      supabaseDbUrl: describe(process.env.SUPABASE_DB_URL),
      databaseUrl: describe(process.env.DATABASE_URL),
    };
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
