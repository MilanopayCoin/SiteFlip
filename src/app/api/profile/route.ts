import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUser } from "@/lib/api/request-user";
import { profileCompletionPercent } from "@/lib/profile/completion";
import type { UserProfile } from "@/lib/profile/types";
import {
  loadProfileById,
  loadProfileByUsername,
  updateProfileFields,
  upsertProfile,
} from "@/lib/profile/supabase-store";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

const updateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username: letters, numbers, underscore only")
    .optional(),
  displayName: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().max(200).optional(),
  skills: z.array(z.string().max(40)).max(20).optional(),
  businessInterests: z.array(z.string().max(60)).max(20).optional(),
  preferredBusinessType: z.string().max(60).optional(),
  budget: z.string().max(60).optional(),
  risk: z.string().max(40).optional(),
  workload: z.string().max(40).optional(),
  userId: z.string().optional(),
  // Allow hydrate from client cache (Worker isolates)
  profile: z.any().optional(),
});

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  const url = new URL(request.url);
  const hydrateId = url.searchParams.get("userId");
  const hydrateHeader = request.headers.get("x-siteflip-demo-user");

  // When production persistence is healthy, demo hydrate headers are blocked
  const userId = user?.id || (!status.productionPersistence ? hydrateId || hydrateHeader : null);
  if (!userId) {
    return NextResponse.json(
      {
        error: "Not authenticated",
        persistenceMode: status.productionPersistence ? "SUPABASE" : "LOCAL",
        schemaReady: status.schemaReady,
        note: status.productionPersistence
          ? "Sign in required — DEMO hydrate disabled"
          : "LOCAL / DEMO / NOT PERSISTED until Supabase profiles schema is available",
      },
      { status: 401 }
    );
  }

  let loaded = await loadProfileById(userId);
  if (!loaded.profile && user) {
    const created = await upsertProfile({
      id: userId,
      email: user.email || `${userId}@siteflip.local`,
      username: `user_${userId.replace(/-/g, "").slice(0, 8)}`,
      displayName: user.email?.split("@")[0] || "User",
    });
    loaded = { profile: created.profile, mode: created.mode };
  }

  const profile = loaded.profile;
  if (!profile) {
    return NextResponse.json(
      {
        error: "Profile not found",
        persistenceMode: loaded.mode.toUpperCase(),
        schemaReady: status.schemaReady,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profile,
    completionPercent: profileCompletionPercent(profile),
    persistenceMode: profile.persistenceMode,
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    note: status.productionPersistence
      ? "Profile loaded from Supabase"
      : status.reason || "LOCAL / DEMO / NOT PERSISTED",
  });
}

export async function PUT(request: Request) {
  await ensureCloudflareEnv();
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Hydrate full profile from client (isolate bridge) — DEMO only when not production-ready
  if (body?.profile && typeof body.profile === "object") {
    const incoming = body.profile as UserProfile;
    if (incoming.id && incoming.username) {
      if (user && incoming.id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (status.productionPersistence && (!user || incoming.id !== user.id)) {
        return NextResponse.json(
          { error: "Forbidden — DEMO hydrate disabled when production Supabase is healthy" },
          { status: 403 }
        );
      }
      const data = parsed.data;
      if (
        data.username &&
        data.username.toLowerCase() !== incoming.username.toLowerCase()
      ) {
        const taken = await loadProfileByUsername(data.username);
        if (taken.profile && taken.profile.id !== incoming.id) {
          return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
      }
      const result = await upsertProfile({
        id: incoming.id,
        email: incoming.email || user?.email || `${incoming.id}@siteflip.local`,
        username: data.username || incoming.username,
        displayName:
          data.displayName !== undefined ? data.displayName : incoming.displayName,
        country: data.country !== undefined ? data.country : incoming.country,
        bio: data.bio !== undefined ? data.bio : incoming.bio,
        website: data.website !== undefined ? data.website : incoming.website,
        skills: data.skills !== undefined ? data.skills : incoming.skills,
        businessInterests:
          data.businessInterests !== undefined
            ? data.businessInterests
            : incoming.businessInterests,
        preferredBusinessType:
          data.preferredBusinessType !== undefined
            ? data.preferredBusinessType
            : incoming.preferredBusinessType,
        budget: data.budget !== undefined ? data.budget : incoming.budget,
        risk: data.risk !== undefined ? data.risk : incoming.risk,
        workload: data.workload !== undefined ? data.workload : incoming.workload,
      });
      return NextResponse.json({
        profile: result.profile,
        completionPercent: profileCompletionPercent(result.profile),
        persistenceMode: result.profile.persistenceMode,
        schemaReady: status.schemaReady,
        note:
          result.mode === "supabase"
            ? "Profile persisted to Supabase"
            : result.error || "LOCAL / DEMO / NOT PERSISTED",
      });
    }
  }

  const userId = user?.id || (!status.productionPersistence ? body?.userId : null);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (status.productionPersistence && user && userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = parsed.data;
  if (data.username) {
    const taken = await loadProfileByUsername(data.username);
    if (taken.profile && taken.profile.id !== userId) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  }

  const result = await updateProfileFields(
    userId,
    user?.email || `${userId}@siteflip.local`,
    {
      username: data.username,
      displayName: data.displayName,
      country: data.country,
      bio: data.bio,
      website: data.website,
      skills: data.skills,
      businessInterests: data.businessInterests,
      preferredBusinessType: data.preferredBusinessType,
      budget: data.budget,
      risk: data.risk,
      workload: data.workload,
    }
  );

  if (!result.profile) {
    return NextResponse.json(
      { error: result.error || "Profile update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile: result.profile,
    completionPercent: profileCompletionPercent(result.profile),
    persistenceMode: result.profile.persistenceMode,
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    note:
      result.mode === "supabase"
        ? "Profile persisted to Supabase"
        : result.error || status.reason || "LOCAL / DEMO / NOT PERSISTED",
  });
}
