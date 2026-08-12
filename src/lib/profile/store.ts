/**
 * In-memory profile store for LOCAL / DEMO until Supabase profiles schema is available.
 * Cloudflare isolates do not share this Map — clients must hydrate via localStorage bridge.
 */

import { emptyProfile } from "./completion";
import type { UserProfile } from "./types";

const g = globalThis as unknown as {
  __siteflipProfiles?: Map<string, UserProfile>;
  __siteflipProfilesByUsername?: Map<string, string>;
};

function byId(): Map<string, UserProfile> {
  if (!g.__siteflipProfiles) g.__siteflipProfiles = new Map();
  return g.__siteflipProfiles;
}

function byUsername(): Map<string, string> {
  if (!g.__siteflipProfilesByUsername) {
    g.__siteflipProfilesByUsername = new Map();
  }
  return g.__siteflipProfilesByUsername;
}

function indexUsername(profile: UserProfile) {
  const map = byUsername();
  for (const [uname, id] of map.entries()) {
    if (id === profile.id) map.delete(uname);
  }
  map.set(profile.username.toLowerCase(), profile.id);
}

export function getProfileById(id: string): UserProfile | null {
  return byId().get(id) ?? null;
}

export function getProfileByUsername(username: string): UserProfile | null {
  const id = byUsername().get(username.toLowerCase());
  if (!id) return null;
  return byId().get(id) ?? null;
}

export function saveProfile(profile: UserProfile): UserProfile {
  profile.updatedAt = new Date().toISOString();
  byId().set(profile.id, profile);
  indexUsername(profile);
  return profile;
}

export function ensureProfile(
  id: string,
  email: string,
  extras?: Partial<UserProfile>
): UserProfile {
  const existing = byId().get(id);
  if (existing) {
    if (extras) {
      const next = { ...existing, ...extras, id, email: email || existing.email };
      return saveProfile(next);
    }
    return existing;
  }
  return saveProfile(emptyProfile(id, email, extras));
}

export function listProfiles(): UserProfile[] {
  return Array.from(byId().values());
}
