import { nanoid } from "nanoid";
import { verifyMessage } from "viem";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SIGNIN_TTL_MS = 1000 * 60 * 10;
const DEV_FALLBACK_SECRET = "jiy-near-dev-session-secret";

type PendingChallenge = {
  wallet: string;
  origin: string;
  issuedAt: string;
  expiresAt: number;
};

const g = globalThis as unknown as {
  __jiyNearSignChallenges?: Map<string, PendingChallenge>;
};

function challenges() {
  if (!g.__jiyNearSignChallenges) g.__jiyNearSignChallenges = new Map();
  return g.__jiyNearSignChallenges;
}

function pruneChallenges() {
  const now = Date.now();
  for (const [nonce, ch] of challenges()) {
    if (ch.expiresAt < now) challenges().delete(nonce);
  }
}

/** Resolve binding origin from the browser Origin header (or Host fallback). */
export function resolveRequestOrigin(request: Request): string {
  const origin = (request.headers.get("origin") || "").trim();
  if (origin && /^https?:\/\//i.test(origin)) {
    try {
      return new URL(origin).origin;
    } catch {
      // fall through
    }
  }
  const host = (request.headers.get("host") || "").trim();
  if (host) {
    const proto =
      (request.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim() ||
      "https";
    return `${proto}://${host}`;
  }
  return "jiy-near://unknown";
}

export function buildSignMessage(
  wallet: string,
  nonce: string,
  issuedAt: string,
  origin: string
): string {
  return [
    "JIY Near — StarKey sign-in",
    "",
    `Wallet: ${wallet}`,
    `Origin: ${origin}`,
    `Issued: ${issuedAt}`,
    `Nonce: ${nonce}`,
    "",
    "Bu imza sadece oturum açmak içindir; gas harcamaz.",
    "Only sign on the Origin above.",
  ].join("\n");
}

export async function issueNonce(
  wallet: string,
  origin: string
): Promise<{
  nonce: string;
  issuedAt: string;
  origin: string;
  message: string;
}> {
  nearSessionSecret();
  pruneChallenges();
  const normalized = wallet.toLowerCase();
  const boundOrigin = origin.trim() || "jiy-near://unknown";
  const nonce = nanoid(24);
  const issuedAt = new Date().toISOString();
  challenges().set(nonce, {
    wallet: normalized,
    origin: boundOrigin,
    issuedAt,
    expiresAt: Date.now() + SIGNIN_TTL_MS,
  });
  return {
    nonce,
    issuedAt,
    origin: boundOrigin,
    message: buildSignMessage(normalized, nonce, issuedAt, boundOrigin),
  };
}

function isNearProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.CF_PAGES === "1"
  );
}

/**
 * Dedicated HMAC key only — never reuse migrate/bootstrap tokens.
 * Production fail-closed when NEAR_SESSION_SECRET is missing.
 */
export function nearSessionSecret(): string {
  const dedicated = (process.env.NEAR_SESSION_SECRET || "").trim();
  if (dedicated) return dedicated;
  if (isNearProductionRuntime()) {
    throw new Error(
      "NEAR_SESSION_SECRET is required in production (no migrate/bootstrap fallback)"
    );
  }
  return DEV_FALLBACK_SECRET;
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(nearSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payloadJson: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadJson)
  );
  return `${b64url(payloadJson)}.${b64url(sig)}`;
}

async function verifyPayload(
  token: string
): Promise<{ wallet: string; exp: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [p, s] = parts;
  if (!p || !s) return null;
  try {
    const payloadBytes = fromB64url(p);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const key = await hmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(s),
      new TextEncoder().encode(payloadJson)
    );
    if (!ok) return null;
    const data = JSON.parse(payloadJson) as { w?: string; exp?: number };
    if (!data.w || !data.exp || data.exp < Date.now()) return null;
    if (!/^0x[a-f0-9]{40}$/.test(data.w)) return null;
    return { wallet: data.w, exp: data.exp };
  } catch {
    return null;
  }
}

/**
 * Consume a server-issued challenge (one-time), verify personal_sign, mint session.
 * `origin` must match the challenge binding (from request Origin).
 */
export async function verifyAndCreateSession(input: {
  wallet: string;
  nonce: string;
  issuedAt: string;
  signature: `0x${string}`;
  origin: string;
}): Promise<{ token: string; wallet: string; expiresAt: string } | null> {
  nearSessionSecret();
  pruneChallenges();

  const normalized = input.wallet.toLowerCase();
  const boundOrigin = input.origin.trim();
  const pending = challenges().get(input.nonce);
  // Consume immediately to prevent parallel replay.
  challenges().delete(input.nonce);

  if (
    !pending ||
    pending.wallet !== normalized ||
    pending.origin !== boundOrigin ||
    pending.issuedAt !== input.issuedAt ||
    pending.expiresAt < Date.now()
  ) {
    return null;
  }

  const message = buildSignMessage(
    normalized,
    input.nonce,
    input.issuedAt,
    boundOrigin
  );
  let ok = false;
  try {
    ok = await verifyMessage({
      address: normalized as `0x${string}`,
      message,
      signature: input.signature,
    });
  } catch {
    return null;
  }
  if (!ok) return null;

  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ w: normalized, exp: expiresAtMs });
  const token = await signPayload(payload);

  return {
    token,
    wallet: normalized,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export async function walletFromAuthHeader(
  header: string | null
): Promise<string | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const verified = await verifyPayload(token);
  return verified?.wallet ?? null;
}
