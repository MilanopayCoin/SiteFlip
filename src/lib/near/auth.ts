import { nanoid } from "nanoid";
import { verifyMessage } from "viem";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SIGNIN_TTL_MS = 1000 * 60 * 10;

export function buildSignMessage(
  wallet: string,
  nonce: string,
  issuedAt: string
): string {
  return [
    "JIY Near — StarKey sign-in",
    "",
    `Wallet: ${wallet}`,
    `Issued: ${issuedAt}`,
    `Nonce: ${nonce}`,
    "",
    "Bu imza sadece oturum açmak içindir; gas harcamaz.",
  ].join("\n");
}

export async function issueNonce(wallet: string): Promise<{
  nonce: string;
  issuedAt: string;
  message: string;
}> {
  const normalized = wallet.toLowerCase();
  const nonce = nanoid(24);
  const issuedAt = new Date().toISOString();
  return {
    nonce,
    issuedAt,
    message: buildSignMessage(normalized, nonce, issuedAt),
  };
}

function sessionSecret(): string {
  return (
    process.env.NEAR_SESSION_SECRET ||
    process.env.QR_MENU_BOOTSTRAP_TOKEN ||
    process.env.MIGRATE_TOKEN ||
    "jiy-near-dev-session-secret"
  );
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
    new TextEncoder().encode(sessionSecret()),
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

export async function verifyAndCreateSession(input: {
  wallet: string;
  nonce: string;
  issuedAt: string;
  signature: `0x${string}`;
}): Promise<{ token: string; wallet: string; expiresAt: string } | null> {
  const normalized = input.wallet.toLowerCase();
  const issuedMs = Date.parse(input.issuedAt);
  if (!Number.isFinite(issuedMs) || Math.abs(Date.now() - issuedMs) > SIGNIN_TTL_MS) {
    return null;
  }

  const message = buildSignMessage(normalized, input.nonce, input.issuedAt);
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
