/**
 * Domain architecture for JIY.APP generated businesses.
 * Never claim verification without real DNS checks.
 * Never automatically modify DNS.
 */

import { nanoid } from "nanoid";
import type { DomainRecord, DomainStatus } from "./types";
import { BRAND } from "@/lib/brand";

const globalStore = globalThis as unknown as {
  __jiyDomains?: Map<string, DomainRecord[]>;
};

function domains(): Map<string, DomainRecord[]> {
  if (!globalStore.__jiyDomains) {
    globalStore.__jiyDomains = new Map();
  }
  return globalStore.__jiyDomains;
}

export function listDomains(projectId: string): DomainRecord[] {
  return domains().get(projectId) ?? [];
}

export function addDomain(
  projectId: string,
  domain: string,
  slug: string
): DomainRecord {
  const record: DomainRecord = {
    domain: domain.toLowerCase().trim(),
    status: "UNVERIFIED",
    cnameTarget: `${slug}.${BRAND.domain}`,
    txtVerification: `jiy-verify=${nanoid(24)}`,
    verifiedAt: null,
    notes: [
      "DNS not modified automatically",
      "Add CNAME pointing to target, or TXT for ownership verification",
      "Status remains UNVERIFIED until real DNS lookup succeeds",
    ],
  };
  const list = domains().get(projectId) ?? [];
  list.push(record);
  domains().set(projectId, list);
  return record;
}

/**
 * Real DNS verification via DNS-over-HTTPS (Cloudflare).
 * Never fakes ownership.
 */
export async function verifyDomainDns(
  projectId: string,
  domain: string
): Promise<DomainRecord> {
  const list = domains().get(projectId) ?? [];
  const record = list.find((d) => d.domain === domain);
  if (!record) throw new Error("Domain not found");

  record.status = "PENDING";
  record.notes.push(`Verification started at ${new Date().toISOString()}`);

  try {
    const txtOk = record.txtVerification
      ? await checkTxtRecord(domain, record.txtVerification)
      : false;
    const cnameOk = record.cnameTarget
      ? await checkCnameRecord(domain, record.cnameTarget)
      : false;

    if (txtOk || cnameOk) {
      record.status = "VERIFIED";
      record.verifiedAt = new Date().toISOString();
      record.notes.push(
        txtOk ? "TXT verification succeeded" : "CNAME verification succeeded"
      );
    } else {
      record.status = "FAILED";
      record.notes.push(
        "DNS verification failed — required TXT or CNAME not found"
      );
    }
  } catch (error) {
    record.status = "FAILED";
    record.notes.push(
      error instanceof Error ? error.message : "DNS lookup error"
    );
  }

  domains().set(projectId, list);
  return record;
}

export function connectDomain(
  projectId: string,
  domain: string
): DomainRecord {
  const list = domains().get(projectId) ?? [];
  const record = list.find((d) => d.domain === domain);
  if (!record) throw new Error("Domain not found");
  if (record.status !== "VERIFIED" && record.status !== "CONNECTED") {
    throw new Error("Domain must be VERIFIED before connect");
  }
  record.status = "CONNECTED";
  record.notes.push("Marked CONNECTED — DNS was verified");
  domains().set(projectId, list);
  return record;
}

export function removeDomain(projectId: string, domain: string): void {
  const list = (domains().get(projectId) ?? []).filter((d) => d.domain !== domain);
  domains().set(projectId, list);
}

async function checkTxtRecord(
  domain: string,
  expected: string
): Promise<boolean> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    Answer?: Array<{ data?: string }>;
  };
  const answers = data.Answer ?? [];
  return answers.some((a) =>
    (a.data || "").replace(/"/g, "").includes(expected)
  );
}

async function checkCnameRecord(
  domain: string,
  expectedTarget: string
): Promise<boolean> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    Answer?: Array<{ data?: string }>;
  };
  const answers = data.Answer ?? [];
  const expected = expectedTarget.replace(/\.$/, "").toLowerCase();
  return answers.some((a) =>
    (a.data || "").replace(/\.$/, "").toLowerCase().includes(expected)
  );
}

export type { DomainStatus };
