/**
 * Verification architecture
 *
 * MVP: Domain ownership via DNS TXT record (DNS-over-HTTPS — Workers compatible).
 * Prefer Web Crypto so this runs on Cloudflare Workers and Node.
 * NEVER fake verification status.
 */

import type {
  VerificationProvider,
  VerificationStatus,
  VerificationType,
} from "@/types/database";

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

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createDomainVerificationChallenge(
  businessId: string,
  domain: string
): VerificationChallenge {
  const token = `siteflip-verify=${randomHex(16)}`;
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

/** DNS-over-HTTPS lookup — works on Cloudflare Workers (no node:dns). */
async function resolveTxtDoH(hostname: string): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "TXT");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) {
    throw new Error(`DoH lookup failed (${res.status})`);
  }
  const data = (await res.json()) as {
    Answer?: Array<{ type: number; data: string }>;
  };
  return (data.Answer ?? [])
    .filter((a) => a.type === 16)
    .map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
}

export async function verifyDomainDns(
  domain: string,
  expectedToken: string
): Promise<VerificationResult> {
  try {
    const flat = await resolveTxtDoH(`_siteflip.${domain}`);
    if (flat.some((r) => r.includes(expectedToken))) {
      return {
        status: "VERIFIED",
        evidence: { domain, records: flat, method: "dns_over_https" },
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
  provider: "mollie" | "shopify" | "paypal";
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
