import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { memoryStore } from "@/lib/data/memory-store";
import type { User } from "@supabase/supabase-js";

export type RequestUser = {
  id: string;
  email: string;
  mode: "supabase" | "demo";
  user?: User;
};

/**
 * Resolve the acting user.
 * - Supabase session when configured + logged in
 * - Optional demo header/cookie fallback only when Supabase is NOT configured
 */
export async function resolveRequestUser(
  request?: Request
): Promise<RequestUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      mode: "supabase",
      user: data.user,
    };
  }

  // DEMO mode only — never impersonate when Supabase is live
  const demoId =
    request?.headers.get("x-siteflip-demo-user") ||
    "demo-user";
  const profile = memoryStore.ensureDemoUser(demoId);
  return { id: profile.id, email: profile.email, mode: "demo" };
}

export function jsonError(message: string, status = 400, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk<T extends object>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
