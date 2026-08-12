/**
 * Server-safe Supabase helpers (sync, process.env / Worker bindings).
 * Client components that need Auth should use `@/lib/supabase/browser`.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublicEnv,
  isSupabaseConfigured as envConfigured,
} from "./env";

export { isSupabaseConfigured } from "./env";

/** Sync browser client using build-time NEXT_PUBLIC_* only (may be null on Workers). Prefer browser.ts in client components. */
export function createBrowserClient() {
  if (!envConfigured()) {
    return null;
  }
  const env = getSupabasePublicEnv()!;
  return createSupabaseClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
