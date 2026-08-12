import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/api/request-user";
import { profileCompletionPercent } from "@/lib/profile/completion";
import { loadProfileById, upsertProfile } from "@/lib/profile/supabase-store";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  let supabaseUser = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      supabaseUser = data.user;
    }
  }

  const active = supabaseUser
    ? {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        mode: "supabase" as const,
      }
    : user
      ? { id: user.id, email: user.email, mode: user.mode }
      : null;

  if (!active) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      profile: null,
      completionPercent: 0,
      persistenceMode: status.productionPersistence ? "SUPABASE" : "LOCAL",
      schemaReady: status.schemaReady,
      note: "Not signed in",
    });
  }

  let loaded = await loadProfileById(active.id);
  if (!loaded.profile && active.mode === "supabase") {
    const meta = supabaseUser?.user_metadata || {};
    const created = await upsertProfile({
      id: active.id,
      email: active.email,
      username:
        String(meta.username || "").replace(/[^a-zA-Z0-9_]/g, "") ||
        `user_${active.id.slice(0, 8)}`,
      displayName: String(meta.display_name || meta.full_name || "User"),
      country: String(meta.country || ""),
    });
    loaded = { profile: created.profile, mode: created.mode };
  }

  const profile = loaded.profile;
  return NextResponse.json({
    authenticated: true,
    user: active,
    profile,
    completionPercent: profile ? profileCompletionPercent(profile) : 0,
    persistenceMode: profile?.persistenceMode || loaded.mode.toUpperCase(),
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    note: status.productionPersistence
      ? "Supabase session + persisted profile"
      : status.reason || "LOCAL / DEMO / NOT PERSISTED — schema not ready",
  });
}
