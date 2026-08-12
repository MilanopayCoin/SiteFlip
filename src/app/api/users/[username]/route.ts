import { NextResponse } from "next/server";
import { getProfileByUsername, saveProfile } from "@/lib/profile/store";
import { toPublicProfile } from "@/lib/profile/completion";
import type { UserProfile } from "@/lib/profile/types";

type Ctx = { params: Promise<{ username: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { username } = await ctx.params;
  const profile = getProfileByUsername(username);

  if (!profile) {
    return NextResponse.json(
      {
        error: "User not found",
        note: "LOCAL / DEMO profiles may only exist in the creator's session",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profile: toPublicProfile(profile),
    persistenceMode: profile.persistenceMode,
    note:
      profile.persistenceMode === "SUPABASE"
        ? "Persisted"
        : "LOCAL / DEMO / NOT PERSISTED",
  });
}

/** Hydrate a LOCAL public profile into this isolate */
export async function PUT(request: Request, ctx: Ctx) {
  const { username } = await ctx.params;
  const body = await request.json().catch(() => null);
  const incoming = body?.profile as UserProfile | undefined;
  if (!incoming || incoming.username.toLowerCase() !== username.toLowerCase()) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }
  if (incoming.persistenceMode === "SUPABASE") {
    return NextResponse.json(
      { error: "Only LOCAL/DEMO profiles can be hydrated" },
      { status: 400 }
    );
  }
  const saved = saveProfile(incoming);
  return NextResponse.json({
    profile: toPublicProfile(saved),
    persistenceMode: saved.persistenceMode,
    note: "LOCAL / DEMO / NOT PERSISTED",
  });
}
