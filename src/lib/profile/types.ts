/** Extended SITEFLIP profile preferences (LOCAL until schema available) */

export type ProfilePersistenceMode = "LOCAL" | "DEMO" | "SUPABASE";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  country: string;
  bio: string;
  website: string;
  skills: string[];
  businessInterests: string[];
  preferredBusinessType: string;
  budget: string;
  risk: string;
  workload: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  persistenceMode: ProfilePersistenceMode;
}

/** Public-safe subset — never includes email or private prefs beyond what user opts to show */
export interface PublicUserProfile {
  username: string;
  displayName: string;
  country: string;
  bio: string;
  website: string;
  skills: string[];
  businessInterests: string[];
  preferredBusinessType: string;
  memberSince: string;
  persistenceMode: ProfilePersistenceMode;
}

export const PROFILE_FIELDS = [
  "username",
  "displayName",
  "country",
  "bio",
  "website",
  "skills",
  "businessInterests",
  "preferredBusinessType",
  "budget",
  "risk",
  "workload",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
