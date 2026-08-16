import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export { isSupabaseConfigured };

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getServerUser();
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function getBrowserUser() {
  const { createBrowserClient } = await import("@/lib/supabase/browser");
  const supabase = await createBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
