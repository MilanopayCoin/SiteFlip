import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUser } from "@/lib/api/request-user";
import {
  ensureProfile,
  getProfileById,
  getProfileByUsername,
  saveProfile,
} from "@/lib/profile/store";
import { profileCompletionPercent } from "@/lib/profile/completion";
import type { UserProfile } from "@/lib/profile/types";

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
  const user = await resolveRequestUser(request);
  const url = new URL(request.url);
  const hydrateId = url.searchParams.get("userId");

  // Prefer authenticated user; allow demo hydrate by id for LOCAL
  const hydrateHeader = request.headers.get("x-siteflip-demo-user");
  const userId = user?.id || hydrateId || hydrateHeader;
  if (!userId) {
    return NextResponse.json(
      {
        error: "Not authenticated",
        persistenceMode: "LOCAL",
        note: "LOCAL / DEMO / NOT PERSISTED until Supabase profiles schema is available",
      },
      { status: 401 }
    );
  }

  let profile = getProfileById(userId);
  if (!profile) {
    profile = ensureProfile(userId, user?.email || `${userId}@siteflip.local`, {
      persistenceMode: "LOCAL",
    });
  }

  return NextResponse.json({
    profile,
    completionPercent: profileCompletionPercent(profile),
    persistenceMode: profile.persistenceMode,
    note: "LOCAL / DEMO / NOT PERSISTED — profile is not permanently stored yet",
  });
}

export async function PUT(request: Request) {
  const user = await resolveRequestUser(request);
  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Hydrate full profile from client (isolate bridge)
  if (body?.profile && typeof body.profile === "object") {
    const incoming = body.profile as UserProfile;
    if (incoming.id && incoming.username) {
      if (user && incoming.id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const data = parsed.data;
      const merged: UserProfile = {
        ...incoming,
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
        persistenceMode: incoming.persistenceMode || "LOCAL",
      };
      if (
        merged.username.toLowerCase() !== incoming.username.toLowerCase()
      ) {
        const taken = getProfileByUsername(merged.username);
        if (taken && taken.id !== merged.id) {
          return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
      }
      const saved = saveProfile(merged);
      return NextResponse.json({
        profile: saved,
        completionPercent: profileCompletionPercent(saved),
        persistenceMode: saved.persistenceMode,
        note: "LOCAL / DEMO / NOT PERSISTED",
      });
    }
  }

  const userId = user?.id || body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profile =
    getProfileById(userId) ||
    ensureProfile(userId, user?.email || `${userId}@siteflip.local`, {
      persistenceMode: "LOCAL",
    });

  const data = parsed.data;
  if (data.username && data.username.toLowerCase() !== profile.username.toLowerCase()) {
    const taken = getProfileByUsername(data.username);
    if (taken && taken.id !== profile.id) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    profile.username = data.username;
  }
  if (data.displayName !== undefined) profile.displayName = data.displayName;
  if (data.country !== undefined) profile.country = data.country;
  if (data.bio !== undefined) profile.bio = data.bio;
  if (data.website !== undefined) profile.website = data.website;
  if (data.skills !== undefined) profile.skills = data.skills;
  if (data.businessInterests !== undefined) {
    profile.businessInterests = data.businessInterests;
  }
  if (data.preferredBusinessType !== undefined) {
    profile.preferredBusinessType = data.preferredBusinessType;
  }
  if (data.budget !== undefined) profile.budget = data.budget;
  if (data.risk !== undefined) profile.risk = data.risk;
  if (data.workload !== undefined) profile.workload = data.workload;
  profile.persistenceMode = "LOCAL";

  const saved = saveProfile(profile);
  return NextResponse.json({
    profile: saved,
    completionPercent: profileCompletionPercent(saved),
    persistenceMode: saved.persistenceMode,
    note: "LOCAL / DEMO / NOT PERSISTED — profile is not permanently stored yet",
  });
}
