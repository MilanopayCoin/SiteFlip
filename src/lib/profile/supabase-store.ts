/**
 * Profile persistence — Supabase HTTP when schema ready, otherwise explicit DEMO.
 * User-facing reads/writes prefer the authenticated session (RLS).
 * Service role is only used as a last-resort server bootstrap when no user session
 * is available (e.g. some webhook/admin paths) — never for browser code.
 * Never falls back silently when production Supabase + schema are healthy.
 */

import { createServiceClient, createClient } from "@/lib/supabase/server";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { emptyProfile } from "./completion";
import type { UserProfile } from "./types";
import {
  ensureProfile as ensureMemoryProfile,
  getProfileById as getMemoryById,
  getProfileByUsername as getMemoryByUsername,
  saveProfile as saveMemoryProfile,
} from "./store";

async function persistenceClient(preferService = false) {
  if (preferService) {
    return (await createServiceClient()) || (await createClient());
  }
  // Prefer user session so RLS applies
  return (await createClient()) || (await createServiceClient());
}
function rowToProfile(row: Record<string, unknown>): UserProfile {
  const base = emptyProfile(String(row.id), String(row.email || ""), {
    username: String(row.username || `user_${String(row.id).slice(0, 8)}`),
    displayName: String(
      row.display_name || row.full_name || row.username || "User"
    ),
    country: String(row.country || ""),
    bio: String(row.bio || ""),
    website: "",
    skills: [],
    businessInterests: [],
    preferredBusinessType: "",
    budget: "",
    risk: "",
    workload: "",
    persistenceMode: "SUPABASE",
  });
  // Extended fields may live in JSON metadata later; keep columns we have
  return {
    ...base,
    createdAt: String(row.created_at || base.createdAt),
    updatedAt: String(row.updated_at || base.updatedAt),
  };
}

export async function loadProfileById(id: string): Promise<{
  profile: UserProfile | null;
  mode: "supabase" | "demo";
}> {
  const status = await getSchemaStatus();
  if (status.productionPersistence) {
    const supabase = await persistenceClient(false);
    if (!supabase) return { profile: null, mode: "supabase" };
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return { profile: null, mode: "supabase" };
    return { profile: rowToProfile(data as Record<string, unknown>), mode: "supabase" };
  }
  return { profile: getMemoryById(id), mode: "demo" };
}

export async function loadProfileByUsername(username: string): Promise<{
  profile: UserProfile | null;
  mode: "supabase" | "demo";
}> {
  const status = await getSchemaStatus();
  if (status.productionPersistence) {
    // Public usernames are readable via RLS (profiles SELECT true)
    const supabase = await persistenceClient(false);
    if (!supabase) return { profile: null, mode: "supabase" };
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", username)
      .maybeSingle();
    if (error || !data) return { profile: null, mode: "supabase" };
    return { profile: rowToProfile(data as Record<string, unknown>), mode: "supabase" };
  }
  return { profile: getMemoryByUsername(username), mode: "demo" };
}

export async function upsertProfile(input: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  country?: string;
  bio?: string;
  website?: string;
  skills?: string[];
  businessInterests?: string[];
  preferredBusinessType?: string;
  budget?: string;
  risk?: string;
  workload?: string;
}): Promise<{ profile: UserProfile; mode: "supabase" | "demo"; error?: string }> {
  const status = await getSchemaStatus();
  if (status.productionPersistence) {
    // Prefer authenticated session (RLS: insert/update own profile).
    // Fall back to service role only if session client is unavailable.
    const supabase = await persistenceClient(false);
    if (!supabase) {
      return {
        profile: ensureMemoryProfile(input.id, input.email, {
          ...input,
          persistenceMode: "LOCAL",
        }),
        mode: "demo",
        error: "Supabase client unavailable — cannot persist profile",
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: input.id,
          email: input.email,
          username: input.username,
          display_name: input.displayName,
          full_name: input.displayName,
          country: input.country || null,
          bio: input.bio || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error || !data) {
      return {
        profile: ensureMemoryProfile(input.id, input.email, {
          ...input,
          persistenceMode: "LOCAL",
        }),
        mode: "demo",
        error: error?.message || "Profile upsert failed",
      };
    }

    // Keep memory mirror for same-isolate speed (not the source of truth)
    const profile = rowToProfile(data as Record<string, unknown>);
    saveMemoryProfile({
      ...profile,
      website: input.website || "",
      skills: input.skills || [],
      businessInterests: input.businessInterests || [],
      preferredBusinessType: input.preferredBusinessType || "",
      budget: input.budget || "",
      risk: input.risk || "",
      workload: input.workload || "",
      persistenceMode: "SUPABASE",
    });
    return {
      profile: {
        ...profile,
        website: input.website || "",
        skills: input.skills || [],
        businessInterests: input.businessInterests || [],
        preferredBusinessType: input.preferredBusinessType || "",
        budget: input.budget || "",
        risk: input.risk || "",
        workload: input.workload || "",
        persistenceMode: "SUPABASE",
      },
      mode: "supabase",
    };
  }

  const profile = saveMemoryProfile(
    ensureMemoryProfile(input.id, input.email, {
      ...input,
      persistenceMode: "DEMO",
    })
  );
  return { profile, mode: "demo" };
}

export async function updateProfileFields(
  id: string,
  email: string,
  patch: Partial<UserProfile>
): Promise<{ profile: UserProfile | null; mode: "supabase" | "demo"; error?: string }> {
  const existing = await loadProfileById(id);
  if (!existing.profile && existing.mode === "supabase") {
    // Create from patch if auth user exists but profile row missing
    if (!patch.username || !patch.displayName) {
      return { profile: null, mode: "supabase", error: "Profile not found" };
    }
  }
  const base =
    existing.profile ||
    ensureMemoryProfile(id, email, {
      username: patch.username || `user_${id.slice(0, 8)}`,
      displayName: patch.displayName || "User",
    });

  return upsertProfile({
    id,
    email,
    username: patch.username ?? base.username,
    displayName: patch.displayName ?? base.displayName,
    country: patch.country ?? base.country,
    bio: patch.bio ?? base.bio,
    website: patch.website ?? base.website,
    skills: patch.skills ?? base.skills,
    businessInterests: patch.businessInterests ?? base.businessInterests,
    preferredBusinessType:
      patch.preferredBusinessType ?? base.preferredBusinessType,
    budget: patch.budget ?? base.budget,
    risk: patch.risk ?? base.risk,
    workload: patch.workload ?? base.workload,
  });
}
