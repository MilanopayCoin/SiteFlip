import { NextResponse } from "next/server";
import { z } from "zod";
import { profileCompletionPercent } from "@/lib/profile/completion";
import {
  loadProfileByUsername,
  upsertProfile,
} from "@/lib/profile/supabase-store";
import { createClient } from "@/lib/supabase/server";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(80),
  country: z.string().max(80).optional(),
});

/**
 * Register via Supabase Auth.
 * When production schema is ready: persist profile to Supabase — no DEMO fallback.
 * DEMO local only when Supabase Auth/schema are not production-ready.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const parsed = registerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, username, displayName, country } = parsed.data;
  const status = await getSchemaStatus();

  const existing = await loadProfileByUsername(username);
  if (existing.profile) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  if (status.configured && status.authReachable) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase Auth client unavailable" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          display_name: displayName,
          username,
          country: country || "",
        },
      },
    });

    if (error) {
      // When production persistence is expected, do NOT silently invent DEMO users
      if (status.productionPersistence) {
        return NextResponse.json(
          {
            error: error.message || "Registration failed",
            mode: "supabase",
            note: "DEMO fallback disabled — production Supabase is healthy",
          },
          { status: 400 }
        );
      }
      // Auth configured but schema not ready — report honestly
      return NextResponse.json(
        {
          error: error.message || "Registration failed",
          mode: "demo",
          note: `Auth error; schemaReady=${status.schemaReady}. ${status.reason || ""}`,
        },
        { status: 400 }
      );
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Auth user missing after signup" },
        { status: 500 }
      );
    }

    const persisted = await upsertProfile({
      id: userId,
      email,
      username,
      displayName,
      country: country || "",
    });

    return NextResponse.json({
      ok: true,
      mode: data.session
        ? persisted.mode === "supabase"
          ? "supabase_session"
          : "supabase_session_profile_pending"
        : "supabase_confirm_email",
      user: { id: userId, email },
      profile: persisted.profile,
      completionPercent: profileCompletionPercent(persisted.profile),
      hasSession: Boolean(data.session),
      persistenceMode: persisted.profile.persistenceMode,
      schemaReady: status.schemaReady,
      note:
        persisted.mode === "supabase"
          ? "Profile persisted to Supabase"
          : `Profile not fully persisted — ${persisted.error || status.reason || "schema pending"}`,
    });
  }

  // DEMO only when Supabase is not production-ready
  return NextResponse.json(
    {
      error: "Supabase Auth not available",
      mode: "demo",
      note: status.reason || "Configure Supabase to enable production registration",
      schemaReady: status.schemaReady,
    },
    { status: 503 }
  );
}
