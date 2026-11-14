"use client";

import { BCS, HexString, SupraClient } from "supra-l1-sdk";
import { TypeTagParser } from "supra-l1-sdk-core";
import {
  bytesToHex,
  isMoveAddress,
  JIY_TOKEN,
  jiyToUnits,
  SUPRA_MOVE_MAINNET,
} from "@/lib/near/jiy-token";
import { getStarkey } from "@/lib/starkey/provider";
import type { StarkeySupraProvider } from "@/lib/starkey/types";

function getSupra(): StarkeySupraProvider {
  const p = getStarkey()?.supra;
  if (!p) throw new Error("StarKey Move (supra) provider yok");
  return p;
}

/** Connect StarKey Move mainnet and return active address. */
export async function connectMoveAccount(): Promise<string | null> {
  const supra = getSupra();
  if (supra.changeNetwork) {
    await supra.changeNetwork({ chainId: SUPRA_MOVE_MAINNET.chainId });
  }
  const accounts = await supra.connect({ chainId: SUPRA_MOVE_MAINNET.chainId });
  if (!accounts?.length) return null;
  const addr = accounts[0]!.toLowerCase();
  if (!isMoveAddress(addr)) {
    throw new Error("Beklenen Move adresi alınamadı");
  }
  return addr;
}

export async function getMoveAccount(): Promise<string | null> {
  const supra = getStarkey()?.supra;
  if (!supra) return null;
  try {
    const accounts = (await (supra.accounts?.() || supra.account?.())) || [];
    const addr = accounts[0]?.toLowerCase() || null;
    return isMoveAddress(addr) ? addr : null;
  } catch {
    return null;
  }
}

/**
 * Transfer JIY fungible asset via StarKey Move.
 * Uses primary_fungible_store::transfer on Supra mainnet.
 */
export async function sendJiyFungibleAsset(input: {
  fromMove: string;
  toMove: string;
  amountJiy: number;
}): Promise<string> {
  if (!isMoveAddress(input.fromMove) || !isMoveAddress(input.toMove)) {
    throw new Error("Geçerli Move adresleri gerekli");
  }
  const supra = getSupra();
  const units = BigInt(jiyToUnits(input.amountJiy));
  if (units <= BigInt(0)) throw new Error("JIY miktarı geçersiz");

  const client = await SupraClient.init(SUPRA_MOVE_MAINNET.rpcUrl);
  const info = await client.getAccountInfo(HexString.ensure(input.fromMove));
  const sequence = BigInt(String(info.sequence_number));

  const metadataTag = new TypeTagParser(
    "0x1::fungible_asset::Metadata"
  ).parseTypeTag();

  const raw = await client.createSerializedRawTxObject(
    HexString.ensure(input.fromMove),
    sequence,
    "0x1",
    "primary_fungible_store",
    "transfer",
    [metadataTag],
    [
      HexString.ensure(JIY_TOKEN.address).toUint8Array(),
      HexString.ensure(input.toMove).toUint8Array(),
      BCS.bcsSerializeUint64(units),
    ],
    {
      maxGas: BigInt(20000),
      txExpiryTime: BigInt(Math.ceil(Date.now() / 1000) + 45),
    }
  );

  const data = bytesToHex(raw);
  if (!supra.sendTransaction) {
    throw new Error("StarKey sendTransaction desteklemiyor — cüzdanı güncelle");
  }
  const txHash = await supra.sendTransaction({
    data,
    from: input.fromMove,
    to: "",
    value: "",
    chainId: SUPRA_MOVE_MAINNET.chainId,
    options: { waitForTransaction: true },
  });
  if (!txHash) throw new Error("JIY transfer iptal edildi");
  return txHash;
}
