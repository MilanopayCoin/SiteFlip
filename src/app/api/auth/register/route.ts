import { NextResponse } from "next/server";
import { z } from "zod";
import { profileCompletionPercent } from "@/lib/profile/completion";
import {
  loadProfileById,
  loadProfileByUsername,
  upsertProfile,
} from "@/lib/profile/supabase-store";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

    // Supabase "Confirm email" leaves signUp without a session. When the Worker
    // has the service role, confirm + sign-in so production apps get a session
    // cookie immediately (email magic-link confirm remains available otherwise).
    let session = data.session;
    let emailAutoConfirmed = false;
    if (!session) {
      const admin = await createServiceClient();
      if (admin) {
        const { error: confirmErr } = await admin.auth.admin.updateUserById(
          userId,
          { email_confirm: true }
        );
        if (!confirmErr) {
          emailAutoConfirmed = true;
          const signed = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signed.data.session) {
            session = signed.data.session;
          }
        }
      }
    }

    let persisted = await upsertProfile({
      id: userId,
      email,
      username,
      displayName,
      country: country || "",
    });

    // Signup trigger may already have written the row — prefer DB truth over LOCAL mirror.
    if (persisted.mode !== "supabase") {
      const fromDb = await loadProfileById(userId);
      if (fromDb.profile && fromDb.mode === "supabase") {
        persisted = {
          profile: {
            ...fromDb.profile,
            username: username || fromDb.profile.username,
            displayName: displayName || fromDb.profile.displayName,
            country: country || fromDb.profile.country,
            persistenceMode: "SUPABASE",
          },
          mode: "supabase",
        };
      }
    }

    return NextResponse.json({
      ok: true,
      mode: session
        ? persisted.mode === "supabase"
          ? "supabase_session"
          : "supabase_session_profile_pending"
        : "supabase_confirm_email",
      user: { id: userId, email },
      profile: persisted.profile,
      completionPercent: profileCompletionPercent(persisted.profile),
      hasSession: Boolean(session),
      emailAutoConfirmed,
      persistenceMode: persisted.profile.persistenceMode,
      schemaReady: status.schemaReady,
      note:
        persisted.mode === "supabase"
          ? session
            ? "Profile persisted to Supabase"
            : "Profile persisted — confirm email to obtain a session"
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
