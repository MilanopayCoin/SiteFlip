import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ensureProfile,
  getProfileByUsername,
  saveProfile,
} from "@/lib/profile/store";
import { profileCompletionPercent } from "@/lib/profile/completion";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

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
 * Register via Supabase Auth when available.
 * Profile fields are stored LOCAL / DEMO until profiles schema exists.
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
  if (getProfileByUsername(username)) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
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
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      const userId = data.user?.id || `local_${nanoid(10)}`;
      const profile = ensureProfile(userId, email, {
        username,
        displayName,
        country: country || "",
        persistenceMode: "LOCAL",
      });
      return NextResponse.json({
        ok: true,
        mode: data.session ? "supabase_session" : "supabase_confirm_email",
        user: { id: userId, email },
        profile,
        completionPercent: profileCompletionPercent(profile),
        hasSession: Boolean(data.session),
        note: "LOCAL / DEMO / NOT PERSISTED — profile fields stored in memory until schema is available",
      });
    }
  }

  // Demo local register (no Supabase Auth)
  const userId = `demo_${nanoid(10)}`;
  const profile = saveProfile(
    ensureProfile(userId, email, {
      username,
      displayName,
      country: country || "",
      persistenceMode: "DEMO",
    })
  );

  return NextResponse.json({
    ok: true,
    mode: "demo_local",
    user: { id: userId, email },
    profile,
    completionPercent: profileCompletionPercent(profile),
    note: "DEMO local account — LOCAL / DEMO / NOT PERSISTED. Not a production identity.",
  });
}
