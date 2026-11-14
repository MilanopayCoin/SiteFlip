import { nanoid } from "nanoid";
import nacl from "tweetnacl";

const LINK_TTL_MS = 1000 * 60 * 10;

type Challenge = {
  moveAddress: string;
  evmWallet: string;
  nonce: string;
  issuedAt: string;
  message: string;
  exp: number;
};

const g = globalThis as unknown as {
  __jiyMoveLinkChallenges?: Map<string, Challenge>;
};

function challenges() {
  if (!g.__jiyMoveLinkChallenges) g.__jiyMoveLinkChallenges = new Map();
  return g.__jiyMoveLinkChallenges;
}

function strip0x(hex: string) {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

function hexToBytes(hex: string): Uint8Array {
  const h = strip0x(hex);
  if (h.length % 2 !== 0) throw new Error("Invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function buildMoveLinkMessage(input: {
  evmWallet: string;
  moveAddress: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "JIY Near — link Supra Move address",
    "",
    `EVM: ${input.evmWallet}`,
    `Move: ${input.moveAddress}`,
    `Issued: ${input.issuedAt}`,
    `Nonce: ${input.nonce}`,
    "",
    "Bu imza Move adresinin sana ait olduğunu kanıtlar; gas harcamaz.",
  ].join("\n");
}

export function issueMoveLinkChallenge(input: {
  evmWallet: string;
  moveAddress: string;
}): Challenge {
  const evmWallet = input.evmWallet.toLowerCase();
  const moveAddress = input.moveAddress.toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(moveAddress)) {
    throw new Error("Geçerli Move adresi gerekli");
  }
  const nonce = nanoid(24);
  const issuedAt = new Date().toISOString();
  const message = buildMoveLinkMessage({
    evmWallet,
    moveAddress,
    nonce,
    issuedAt,
  });
  const challenge: Challenge = {
    moveAddress,
    evmWallet,
    nonce,
    issuedAt,
    message,
    exp: Date.now() + LINK_TTL_MS,
  };
  challenges().set(`${evmWallet}:${nonce}`, challenge);
  return challenge;
}

export function verifyMoveLinkProof(input: {
  evmWallet: string;
  moveAddress: string;
  nonce: string;
  issuedAt: string;
  signature: string;
  publicKey: string;
}): boolean {
  const evmWallet = input.evmWallet.toLowerCase();
  const moveAddress = input.moveAddress.toLowerCase();
  const key = `${evmWallet}:${input.nonce}`;
  const stored = challenges().get(key);
  if (!stored) return false;
  if (stored.exp < Date.now()) {
    challenges().delete(key);
    return false;
  }
  if (stored.moveAddress !== moveAddress) return false;
  if (stored.issuedAt !== input.issuedAt) return false;

  const message = buildMoveLinkMessage({
    evmWallet,
    moveAddress,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
  });
  if (message !== stored.message) return false;

  try {
    const msgBytes = new TextEncoder().encode(message);
    const sig = hexToBytes(input.signature);
    const pub = hexToBytes(input.publicKey);
    // Ed25519: signature 64 bytes, public key 32 bytes
    if (sig.length !== 64 || pub.length !== 32) return false;
    const ok = nacl.sign.detached.verify(msgBytes, sig, pub);
    if (!ok) return false;
    challenges().delete(key);
    return true;
  } catch {
    return false;
  }
}
