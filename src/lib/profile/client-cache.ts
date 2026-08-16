/**
 * Client-side profile cache for Worker isolate bridging + demo auth session.
 */

import type { UserProfile } from "./types";

const PROFILE_KEY = "siteflip_profile_v1";
const SESSION_KEY = "siteflip_demo_session_v1";

export function cacheProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function readCachedProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function clearCachedProfile() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_KEY);
}

export type DemoSession = {
  userId: string;
  email: string;
  mode: "demo" | "supabase";
};

export function saveDemoSession(session: DemoSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function readDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  clearCachedProfile();
}
