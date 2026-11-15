"use client";

import { stringToHex } from "viem";
import {
  ensureSupraEvmDevnet,
  getStarkeyEthereum,
} from "@/lib/starkey/provider";
import { getGift, weiToHex } from "@/lib/near/gifts";
import { jiyToUnits } from "@/lib/near/jiy-token";
import {
  connectMoveAccount,
  getMoveAccount,
  sendJiyFungibleAsset,
  signMoveLinkMessage,
} from "@/lib/near/send-jiy";
import { SUPRA_EVM_DEVNET } from "@/lib/starkey/networks";

const TOKEN_KEY = "jiy-near-session";

export function getNearToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setNearToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function nearFetch(path: string, init?: RequestInit) {
  const token = getNearToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/** StarKey personal_sign → Near session. */
export async function signInWithStarkey(wallet: string): Promise<string> {
  const provider = getStarkeyEthereum();
  if (!provider) throw new Error("StarKey not installed");

  // Drop legacy memory-session tokens before minting HMAC session
  setNearToken(null);

  const challenge = await nearFetch(
    `/api/near/session?wallet=${encodeURIComponent(wallet)}`
  );
  // StarKey (ethers) requires hex-encoded UTF-8 for personal_sign — plain
  // strings throw INVALID_ARGUMENT / invalid BytesLike value.
  const hexMessage = stringToHex(challenge.message as string);
  const signature = (await provider.request({
    method: "personal_sign",
    params: [hexMessage, wallet],
  })) as string;

  const { session } = await nearFetch("/api/near/session", {
    method: "POST",
    body: JSON.stringify({
      wallet,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      signature,
    }),
  });
  setNearToken(session.token);
  return session.token as string;
}

/**
 * Send catalog gift as JIY Move FA when both sides have Move addresses.
 * Falls back to ledger-only (no tx) if peer has no Move link — social score still counts.
 */
export async function sendGiftOnChain(input: {
  from: string;
  to: string;
  giftId: string;
}): Promise<{ txHash: string | null; mode: "jiy" | "ledger" }> {
  const gift = getGift(input.giftId);
  if (!gift) throw new Error("Unknown gift");

  let txHash: string | null = null;
  let mode: "jiy" | "ledger" = "ledger";

  const peer = await nearFetch(
    `/api/near/profile?peer=${encodeURIComponent(input.to)}`
  ).catch(() => null);
  const peerMove =
    (peer?.profile?.moveAddress as string | undefined)?.toLowerCase() || null;

  // Sender Move account is used only for this transfer — never auto-link
  // without Ed25519 proof (see linkMoveAddressWithProof).
  let myMove = await getMoveAccount();
  if (!myMove) {
    myMove = await connectMoveAccount();
  }

  if (myMove && peerMove) {
    txHash = await sendJiyFungibleAsset({
      fromMove: myMove,
      toMove: peerMove,
      amountJiy: gift.amountJiy,
    });
    mode = "jiy";
  }

  await nearFetch("/api/near/gifts", {
    method: "POST",
    body: JSON.stringify({
      toWallet: input.to,
      giftId: input.giftId,
      txHash,
    }),
  });
  return { txHash, mode };
}

/**
 * Contribute to the local place pot. If NEXT_PUBLIC_JIY_NEAR_POT_ADDRESS is set,
 * sends EVM native on Devnet to that treasury; otherwise records ledger-only.
 * Amounts are recorded in JIY base units.
 */
export async function contributePlacePot(input: {
  from: string;
  giftId: string;
}): Promise<{ txHash: string | null }> {
  const gift = getGift(input.giftId);
  if (!gift) throw new Error("Unknown gift");
  const potAddr = process.env.NEXT_PUBLIC_JIY_NEAR_POT_ADDRESS;

  let txHash: string | null = null;
  if (potAddr && /^0x[a-fA-F0-9]{40}$/.test(potAddr)) {
    const provider = getStarkeyEthereum();
    if (!provider) throw new Error("StarKey not installed");
    await ensureSupraEvmDevnet(provider);
    // Pot treasury still on EVM Devnet — value is JIY-sized units for ledger parity.
    txHash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: input.from,
          to: potAddr,
          value: weiToHex(jiyToUnits(gift.amountJiy)),
          chainId: SUPRA_EVM_DEVNET.chainId,
        },
      ],
    })) as string;
  }

  await nearFetch("/api/near/pots", {
    method: "POST",
    body: JSON.stringify({ giftId: input.giftId, txHash }),
  });
  return { txHash };
}

/** Connect Move + prove possession, then persist moveAddress on profile. */
export async function linkMoveAddressWithProof(): Promise<string> {
  const addr = await connectMoveAccount();
  if (!addr) throw new Error("Move bağlantısı iptal");
  const challenge = await nearFetch(
    `/api/near/profile?move=challenge&moveAddress=${encodeURIComponent(addr)}`
  );
  const signed = await signMoveLinkMessage(challenge.message as string);
  const signedAddr = (signed.address || "").toLowerCase();
  if (signedAddr && signedAddr !== addr) {
    throw new Error("StarKey imza adresi bağlı Move hesabıyla uyuşmuyor");
  }
  const data = await nearFetch("/api/near/profile", {
    method: "PUT",
    body: JSON.stringify({
      moveAddress: addr,
      moveProof: {
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        signature: signed.signature,
        publicKey: signed.publicKey,
        signedAddress: signed.address || addr,
      },
    }),
  });
  return (data.profile?.moveAddress as string) || addr;
}

export { connectMoveAccount, getMoveAccount };
