import { nanoid } from "nanoid";
import { verifyMessage } from "viem";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

const g = globalThis as unknown as {
  __jiyNearSessions?: Map<string, { wallet: string; expiresAt: number }>;
  __jiyNearNonces?: Map<string, { wallet: string; expiresAt: number }>;
};

function sessions() {
  if (!g.__jiyNearSessions) g.__jiyNearSessions = new Map();
  return g.__jiyNearSessions;
}

function nonces() {
  if (!g.__jiyNearNonces) g.__jiyNearNonces = new Map();
  return g.__jiyNearNonces;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const NONCE_TTL_MS = 1000 * 60 * 10;

export function buildSignMessage(wallet: string, nonce: string): string {
  return [
    "JIY Near — StarKey sign-in",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "",
    "Bu imza sadece oturum açmak içindir; gas harcamaz.",
  ].join("\n");
}

export async function issueNonce(wallet: string): Promise<{
  nonce: string;
  message: string;
}> {
  const normalized = wallet.toLowerCase();
  const nonce = nanoid(24);
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces().set(nonce, { wallet: normalized, expiresAt });
  return { nonce, message: buildSignMessage(normalized, nonce) };
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function verifyAndCreateSession(input: {
  wallet: string;
  nonce: string;
  signature: `0x${string}`;
}): Promise<{ token: string; wallet: string; expiresAt: string } | null> {
  const normalized = input.wallet.toLowerCase();
  const entry = nonces().get(input.nonce);
  if (!entry || entry.wallet !== normalized || entry.expiresAt < Date.now()) {
    return null;
  }
  nonces().delete(input.nonce);

  const message = buildSignMessage(normalized, input.nonce);
  const ok = await verifyMessage({
    address: normalized as `0x${string}`,
    message,
    signature: input.signature,
  });
  if (!ok) return null;

  const token = nanoid(40);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();
  sessions().set(token, { wallet: normalized, expiresAt: expiresAtMs });

  const client = await db();
  if (client) {
    await client.from("near_sessions").upsert({
      token,
      wallet: normalized,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
  }

  return { token, wallet: normalized, expiresAt };
}

export async function walletFromAuthHeader(
  header: string | null
): Promise<string | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const mem = sessions().get(token);
  if (mem && mem.expiresAt > Date.now()) return mem.wallet;

  const client = await db();
  if (!client) return null;
  const { data } = await client
    .from("near_sessions")
    .select("wallet, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  sessions().set(token, {
    wallet: data.wallet,
    expiresAt: new Date(data.expires_at).getTime(),
  });
  return data.wallet as string;
}
