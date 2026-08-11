/**
 * Verification architecture
 *
 * MVP: Domain ownership via DNS TXT record.
 * Prepared interfaces for Stripe, Shopify, GA, GSC, PayPal, Cloudflare.
 * NEVER fake verification status.
 *
 * Server-only DNS helpers — do not import this file from Client Components.
 * Use @/lib/verification/labels for badge labels on the client.
 */

import type {
  VerificationProvider,
  VerificationStatus,
  VerificationType,
} from "@/types/database";
import { randomBytes } from "crypto";

export {
  VERIFICATION_BADGE_LABELS,
  PENDING_INTEGRATIONS,
} from "./labels";

export interface VerificationChallenge {
  businessId: string;
  type: VerificationType;
  provider: VerificationProvider;
  token: string;
  instructions: string;
  recordName?: string;
  recordValue?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  evidence: Record<string, unknown> | null;
  message: string;
}

export function createDomainVerificationChallenge(
  businessId: string,
  domain: string
): VerificationChallenge {
  const token = `siteflip-verify=${randomBytes(16).toString("hex")}`;
  return {
    businessId,
    type: "DOMAIN",
    provider: "dns_txt",
    token,
    recordName: `_siteflip.${domain}`,
    recordValue: token,
    instructions: `Add a DNS TXT record on _siteflip.${domain} with value: ${token}`,
  };
}

export async function verifyDomainDns(
  domain: string,
  expectedToken: string
): Promise<VerificationResult> {
  try {
    const { promises: dns } = await import("node:dns");
    const records = await dns.resolveTxt(`_siteflip.${domain}`);
    const flat = records.map((r) => r.join(""));
    if (flat.some((r) => r.includes(expectedToken))) {
      return {
        status: "VERIFIED",
        evidence: { domain, records: flat, method: "dns_txt" },
        message: "Domain ownership verified via DNS TXT.",
      };
    }
    return {
      status: "FAILED",
      evidence: { domain, records: flat },
      message: "TXT record not found or does not match.",
    };
  } catch (error) {
    return {
      status: "FAILED",
      evidence: {
        domain,
        error: error instanceof Error ? error.message : "DNS lookup failed",
      },
      message: "Could not resolve DNS TXT record.",
    };
  }
}

/** Interfaces prepared for future integrations — not implemented as fake verifies */
export interface RevenueVerifier {
  provider: "stripe" | "shopify" | "paypal";
  connect(userId: string): Promise<{ authUrl: string }>;
  fetchRevenue(connectionId: string, periodDays: number): Promise<{
    revenue: number;
    currency: string;
    verified: true;
  }>;
}

export interface TrafficVerifier {
  provider: "google_analytics" | "google_search_console" | "cloudflare";
  connect(userId: string): Promise<{ authUrl: string }>;
  fetchTraffic(connectionId: string, periodDays: number): Promise<{
    sessions: number;
    verified: true;
  }>;
}
