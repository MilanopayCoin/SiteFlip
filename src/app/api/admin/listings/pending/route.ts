import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

async function requireAdmin(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return { error: jsonError("Authentication required", 401) };
  if (user.mode !== "supabase" || !isSupabaseConfigured()) {
    return { error: jsonError("Admin requires Supabase", 503) };
  }
  const supabase = (await createServiceClient()) || (await createClient());
  if (!supabase) return { error: jsonError("Database unavailable", 503) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { user, supabase };
}

/** Admin-only: PENDING listings awaiting moderation */
export async function GET(request: Request) {
  await ensureCloudflareEnv().catch(() => undefined);
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;

  const { data, error } = await auth.supabase!
    .from("listings")
    .select("id, title, status, listing_type, price, seller_id, created_at")
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ listings: data ?? [] });
}
