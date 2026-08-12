"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type PublicConfig = {
  configured: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
};

let cachedClient: SupabaseClient | null = null;
let cachedConfig: PublicConfig | null = null;
let configPromise: Promise<PublicConfig> | null = null;

async function loadPublicConfig(): Promise<PublicConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    // Prefer build-time public env when present (local/dev)
    const buildUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const buildKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (buildUrl && buildKey) {
      let url = buildUrl.trim().replace(/\/$/, "");
      if (/^[a-z0-9]{15,32}$/i.test(url)) {
        url = `https://${url.toLowerCase()}.supabase.co`;
      } else if (/^[a-z0-9-]+\.supabase\.co$/i.test(url)) {
        url = `https://${url.toLowerCase()}`;
      }
      cachedConfig = {
        configured: true,
        supabaseUrl: url,
        supabaseAnonKey: buildKey,
      };
      return cachedConfig;
    }

    // Cloudflare Worker: read runtime public config (never service role)
    const res = await fetch("/api/public-config", { cache: "no-store" });
    const data = (await res.json()) as PublicConfig;
    cachedConfig = data;
    return data;
  })();

  try {
    return await configPromise;
  } finally {
    configPromise = null;
  }
}

export function isSupabaseConfiguredSync(): boolean {
  return Boolean(
    cachedConfig?.configured ||
      (process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export async function isSupabaseConfigured(): Promise<boolean> {
  const cfg = await loadPublicConfig();
  return Boolean(cfg.configured && cfg.supabaseUrl && cfg.supabaseAnonKey);
}

export async function createBrowserClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  const cfg = await loadPublicConfig();
  if (!cfg.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }
  cachedClient = createSupabaseClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

export async function getPublicSupabaseConfig() {
  return loadPublicConfig();
}
