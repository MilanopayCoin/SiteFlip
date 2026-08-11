import type { VerificationType } from "@/types/database";

export const VERIFICATION_BADGE_LABELS: Record<VerificationType, string> = {
  DOMAIN: "Domain Verified",
  OWNERSHIP: "Ownership Verified",
  REVENUE: "Revenue Verified",
  TRAFFIC: "Traffic Verified",
  BUSINESS: "Business Verified",
};

export const PENDING_INTEGRATIONS = [
  "stripe",
  "shopify",
  "google_analytics",
  "google_search_console",
  "paypal",
  "cloudflare",
] as const;
