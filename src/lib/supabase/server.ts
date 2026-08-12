import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  ensureCloudflareEnv,
  getSupabasePublicEnv,
  getSupabaseServerEnv,
  isSupabaseConfigured,
} from "./env";

export async function createClient() {
  await ensureCloudflareEnv();
  if (!isSupabaseConfigured()) {
    return null;
  }

  const env = getSupabasePublicEnv()!;
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — ignore
        }
      },
    },
  });
}

/**
 * Service-role client — server/Worker only. Never import from client components.
 */
export async function createServiceClient() {
  await ensureCloudflareEnv();
  const env = getSupabaseServerEnv();
  if (!env?.serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
