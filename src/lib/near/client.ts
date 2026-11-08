"use client";

import {
  ensureSupraEvmDevnet,
  getStarkeyEthereum,
} from "@/lib/starkey/provider";
import { getGift, supraToWei, weiToHex } from "@/lib/near/gifts";
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

  const challenge = await nearFetch(
    `/api/near/session?wallet=${encodeURIComponent(wallet)}`
  );
  const signature = (await provider.request({
    method: "personal_sign",
    params: [challenge.message, wallet],
  })) as string;

  const { session } = await nearFetch("/api/near/session", {
    method: "POST",
    body: JSON.stringify({
      wallet,
      nonce: challenge.nonce,
      signature,
    }),
  });
  setNearToken(session.token);
  return session.token as string;
}

/** Send catalog gift as native SUPRA transfer, then ledger it. */
export async function sendGiftOnChain(input: {
  from: string;
  to: string;
  giftId: string;
}): Promise<{ txHash: string }> {
  const gift = getGift(input.giftId);
  if (!gift) throw new Error("Unknown gift");
  const provider = getStarkeyEthereum();
  if (!provider) throw new Error("StarKey not installed");

  await ensureSupraEvmDevnet(provider);
  const value = weiToHex(supraToWei(gift.amountSupra));
  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: input.from,
        to: input.to,
        value,
        chainId: SUPRA_EVM_DEVNET.chainId,
      },
    ],
  })) as string;

  await nearFetch("/api/near/gifts", {
    method: "POST",
    body: JSON.stringify({
      toWallet: input.to,
      giftId: input.giftId,
      txHash,
    }),
  });
  return { txHash };
}

/**
 * Contribute to the local place pot. If NEXT_PUBLIC_JIY_NEAR_POT_ADDRESS is set,
 * sends SUPRA on-chain to that treasury; otherwise records ledger-only.
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
    txHash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: input.from,
          to: potAddr,
          value: weiToHex(supraToWei(gift.amountSupra)),
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
