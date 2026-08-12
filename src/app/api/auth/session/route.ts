import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getProfileById, ensureProfile } from "@/lib/profile/store";
import { profileCompletionPercent } from "@/lib/profile/completion";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function GET(request: Request) {
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
    ? { id: supabaseUser.id, email: supabaseUser.email || "", mode: "supabase" as const }
    : user
      ? { id: user.id, email: user.email, mode: user.mode }
      : null;

  if (!active) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      profile: null,
      completionPercent: 0,
      persistenceMode: "LOCAL",
      note: "Not signed in",
    });
  }

  const profile =
    getProfileById(active.id) ||
    ensureProfile(active.id, active.email, { persistenceMode: "LOCAL" });

  return NextResponse.json({
    authenticated: true,
    user: active,
    profile,
    completionPercent: profileCompletionPercent(profile),
    persistenceMode: profile.persistenceMode,
    note: "LOCAL / DEMO / NOT PERSISTED until Supabase profiles schema is available",
  });
}
