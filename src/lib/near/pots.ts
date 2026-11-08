import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { getGift, supraToWei } from "@/lib/near/gifts";
import type { NearPlacePot } from "@/lib/near/types";

const g = globalThis as unknown as {
  __jiyNearPots?: Map<string, NearPlacePot>;
  __jiyNearPotEvents?: Array<{
    id: string;
    geohash: string;
    fromWallet: string;
    giftId: string;
    amountWei: string;
    txHash: string | null;
    createdAt: string;
  }>;
};

function pots() {
  if (!g.__jiyNearPots) g.__jiyNearPots = new Map();
  return g.__jiyNearPots;
}
function events() {
  if (!g.__jiyNearPotEvents) g.__jiyNearPotEvents = [];
  return g.__jiyNearPotEvents;
}

function now() {
  return new Date().toISOString();
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function getPot(geohash: string): Promise<NearPlacePot> {
  const key = geohash.slice(0, 5);
  const mem = pots().get(key);
  if (mem) return mem;

  const client = await db();
  if (client) {
    const { data } = await client
      .from("near_place_pots")
      .select("*")
      .eq("geohash", key)
      .maybeSingle();
    if (data) {
      const pot: NearPlacePot = {
        geohash: data.geohash,
        totalWei: data.total_wei,
        giftCount: data.gift_count,
        updatedAt: data.updated_at,
      };
      pots().set(key, pot);
      return pot;
    }
  }

  const empty: NearPlacePot = {
    geohash: key,
    totalWei: "0",
    giftCount: 0,
    updatedAt: now(),
  };
  pots().set(key, empty);
  return empty;
}

export async function contributeToPot(input: {
  geohash: string;
  fromWallet: string;
  giftId: string;
  txHash: string | null;
}): Promise<NearPlacePot> {
  const gift = getGift(input.giftId);
  if (!gift) throw new Error("Unknown gift");
  const key = input.geohash.slice(0, 5);
  const pot = await getPot(key);
  const amountWei = supraToWei(gift.amountSupra);
  pot.totalWei = (BigInt(pot.totalWei) + BigInt(amountWei)).toString();
  pot.giftCount += 1;
  pot.updatedAt = now();
  pots().set(key, pot);

  const ev = {
    id: nanoid(16),
    geohash: key,
    fromWallet: input.fromWallet.toLowerCase(),
    giftId: input.giftId,
    amountWei,
    txHash: input.txHash,
    createdAt: pot.updatedAt,
  };
  events().unshift(ev);

  const client = await db();
  if (client) {
    await client.from("near_place_pots").upsert({
      geohash: key,
      total_wei: pot.totalWei,
      gift_count: pot.giftCount,
      updated_at: pot.updatedAt,
    });
    await client.from("near_place_pot_events").insert({
      id: ev.id,
      geohash: key,
      from_wallet: ev.fromWallet,
      gift_id: ev.giftId,
      amount_wei: ev.amountWei,
      tx_hash: ev.txHash,
      created_at: ev.createdAt,
    });
  }
  return pot;
}

export async function recentPotEvents(geohash: string, limit = 20) {
  const key = geohash.slice(0, 5);
  const mem = events().filter((e) => e.geohash === key).slice(0, limit);
  if (mem.length) return mem;
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from("near_place_pot_events")
    .select("*")
    .eq("geohash", key)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map((row) => ({
    id: row.id,
    geohash: row.geohash,
    fromWallet: row.from_wallet,
    giftId: row.gift_id,
    amountWei: row.amount_wei,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  }));
}

export type PotDrawResult = {
  geohash: string;
  winnerWallet: string;
  entrants: number;
  totalWei: string;
  drawnAt: string;
  /** Replace with Supra dVRF proof when wired. */
  entropySource: "node-crypto";
};

const draws = globalThis as unknown as {
  __jiyNearDraws?: PotDrawResult[];
};

function drawLog() {
  if (!draws.__jiyNearDraws) draws.__jiyNearDraws = [];
  return draws.__jiyNearDraws;
}

/**
 * Fair-ish local draw among unique contributors in this geohash pot.
 * Production: swap entropy for Supra dVRF callback.
 */
export async function drawPotWinner(geohash: string): Promise<PotDrawResult> {
  const key = geohash.slice(0, 5);
  const list = await recentPotEvents(key, 200);
  const unique = [...new Set(list.map((e) => e.fromWallet))];
  if (unique.length < 1) throw new Error("No entrants in this pot");

  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const idx = buf[0]! % unique.length;
  const pot = await getPot(key);
  const result: PotDrawResult = {
    geohash: key,
    winnerWallet: unique[idx],
    entrants: unique.length,
    totalWei: pot.totalWei,
    drawnAt: now(),
    entropySource: "node-crypto",
  };
  drawLog().unshift(result);
  return result;
}

export function lastDraw(geohash: string): PotDrawResult | null {
  const key = geohash.slice(0, 5);
  return drawLog().find((d) => d.geohash === key) || null;
}
