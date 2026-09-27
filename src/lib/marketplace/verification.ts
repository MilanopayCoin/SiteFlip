import type { BusinessVerification } from "@/types/database";

export type VerificationLane =
  | "OWNERSHIP"
  | "REVENUE"
  | "ANALYTICS"
  | "DOMAIN"
  | "CODE_ASSETS"
  | "IDENTITY";

export type LaneState = "PENDING" | "VERIFIED" | "FAILED" | "NOT_PROVIDED";

const LANE_TO_TYPES: Record<VerificationLane, string[]> = {
  OWNERSHIP: ["OWNERSHIP", "BUSINESS"],
  REVENUE: ["REVENUE"],
  ANALYTICS: ["ANALYTICS", "TRAFFIC"],
  DOMAIN: ["DOMAIN"],
  CODE_ASSETS: ["CODE_ASSETS"],
  IDENTITY: ["IDENTITY"],
};

export function laneState(
  lane: VerificationLane,
  verifications: BusinessVerification[] | null | undefined
): LaneState {
  const types = LANE_TO_TYPES[lane];
  const rows = (verifications || []).filter((v) => types.includes(v.type));
  if (!rows.length) return "NOT_PROVIDED";
  if (rows.some((v) => v.status === "VERIFIED")) return "VERIFIED";
  if (rows.some((v) => v.status === "FAILED")) return "FAILED";
  return "PENDING";
}

/** Badge only when at least one verification is VERIFIED */
export function isJiyVerified(
  verifications: BusinessVerification[] | null | undefined
): boolean {
  return (verifications || []).some((v) => v.status === "VERIFIED");
}

export function transferReadiness(
  verifications: BusinessVerification[] | null | undefined
): "READY" | "NOT_READY" {
  const ownership = laneState("OWNERSHIP", verifications);
  const domain = laneState("DOMAIN", verifications);
  return ownership === "VERIFIED" && domain === "VERIFIED"
    ? "READY"
    : "NOT_READY";
}

export function claimLabel(
  verified: boolean
): "VERIFIED" | "UNVERIFIED" {
  return verified ? "VERIFIED" : "UNVERIFIED";
}
