import type { PublicUserProfile, UserProfile } from "./types";
import { PROFILE_FIELDS } from "./types";

export function profileCompletionPercent(profile: UserProfile | null): number {
  if (!profile) return 0;
  let filled = 0;
  for (const key of PROFILE_FIELDS) {
    const v = profile[key];
    if (Array.isArray(v)) {
      if (v.length > 0) filled += 1;
    } else if (typeof v === "string" && v.trim()) {
      filled += 1;
    }
  }
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

export function toPublicProfile(profile: UserProfile): PublicUserProfile {
  return {
    username: profile.username,
    displayName: profile.displayName,
    country: profile.country,
    bio: profile.bio,
    website: profile.website,
    skills: profile.skills,
    businessInterests: profile.businessInterests,
    preferredBusinessType: profile.preferredBusinessType,
    memberSince: profile.createdAt,
    persistenceMode: profile.persistenceMode,
  };
}

export function emptyProfile(
  id: string,
  email: string,
  extras?: Partial<UserProfile>
): UserProfile {
  const now = new Date().toISOString();
  const baseName = email.split("@")[0] || "user";
  const username =
    extras?.username ||
    baseName.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 24) ||
    `user_${id.slice(0, 6)}`;
  return {
    id,
    email,
    username,
    displayName: extras?.displayName || baseName,
    country: extras?.country || "",
    bio: extras?.bio || "",
    website: extras?.website || "",
    skills: extras?.skills || [],
    businessInterests: extras?.businessInterests || [],
    preferredBusinessType: extras?.preferredBusinessType || "",
    budget: extras?.budget || "",
    risk: extras?.risk || "",
    workload: extras?.workload || "",
    avatarUrl: extras?.avatarUrl ?? null,
    createdAt: extras?.createdAt || now,
    updatedAt: now,
    persistenceMode: extras?.persistenceMode || "LOCAL",
  };
}
