import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { getGift, supraToWei } from "@/lib/near/gifts";
import { unitsToJiy } from "@/lib/near/jiy-token";
import { creditWalletJiy } from "@/lib/near/match-bets";
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

function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    err.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function getPot(geohash: string): Promise<NearPlacePot> {
  const key = geohash.slice(0, 5);
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_place_pots")
      .select("*")
      .eq("geohash", key)
      .maybeSingle();
    if (!error && data) {
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

  const mem = pots().get(key);
  if (mem) return mem;

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
  const amountWei = supraToWei(gift.amountJiy);
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
    const { error: potErr } = await client.from("near_place_pots").upsert({
      geohash: key,
      total_wei: pot.totalWei,
      gift_count: pot.giftCount,
      updated_at: pot.updatedAt,
    });
    if (potErr && !isSchemaGap(potErr)) {
      throw new Error(potErr.message || "pot upsert failed");
    }
    const { error: evErr } = await client.from("near_place_pot_events").insert({
      id: ev.id,
      geohash: key,
      from_wallet: ev.fromWallet,
      gift_id: ev.giftId,
      amount_wei: ev.amountWei,
      tx_hash: ev.txHash,
      created_at: ev.createdAt,
    });
    if (evErr && !isSchemaGap(evErr)) {
      throw new Error(evErr.message || "pot event insert failed");
    }
  }
  return pot;
}

export type PotEvent = {
  id: string;
  geohash: string;
  fromWallet: string;
  giftId: string;
  amountWei: string;
  txHash: string | null;
  createdAt: string;
};

export async function recentPotEvents(
  geohash: string,
  limit = 20
): Promise<PotEvent[]> {
  const key = geohash.slice(0, 5);
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_place_pot_events")
      .select("*")
      .eq("geohash", key)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const rows = data.map((row) => ({
        id: row.id as string,
        geohash: row.geohash as string,
        fromWallet: String(row.from_wallet).toLowerCase(),
        giftId: row.gift_id as string,
        amountWei: String(row.amount_wei),
        txHash: (row.tx_hash as string | null) || null,
        createdAt: row.created_at as string,
      }));
      for (const r of rows) {
        if (!events().some((e) => e.id === r.id)) events().unshift(r);
      }
      return rows;
    }
    if (error && !isSchemaGap(error)) {
      throw new Error(error.message || "pot events load failed");
    }
  }
  return events().filter((e) => e.geohash === key).slice(0, limit);
}

export type PotDrawResult = {
  id: string;
  geohash: string;
  winnerWallet: string;
  entrants: number;
  totalWei: string;
  payoutJiy: number;
  drawnAt: string;
  /** commit-reveal now; supra-dvrf when oracle wired. */
  entropySource: "commit-reveal" | "supra-dvrf";
  seedCommit: string;
  seedReveal: string;
  proof: {
    algorithm: string;
    totalWeight: string;
    winnerWeight: string;
    roll: string;
  };
  payoutStatus: "credited" | "pending_move" | "failed";
};

const draws = globalThis as unknown as {
  __jiyNearDraws?: PotDrawResult[];
};

function drawLog() {
  if (!draws.__jiyNearDraws) draws.__jiyNearDraws = [];
  return draws.__jiyNearDraws;
}

function sha256Hex(hexOrUtf8: string, asHex = false): string {
  const h = createHash("sha256");
  if (asHex) h.update(Buffer.from(hexOrUtf8, "hex"));
  else h.update(hexOrUtf8);
  return h.digest("hex");
}

type WeightRow = { wallet: string; weight: bigint };

function weightByContribution(list: PotEvent[]): WeightRow[] {
  const map = new Map<string, bigint>();
  for (const e of list) {
    const w = e.fromWallet.toLowerCase();
    const amt = BigInt(e.amountWei || "0");
    if (amt <= BigInt(0)) continue;
    map.set(w, (map.get(w) || BigInt(0)) + amt);
  }
  return [...map.entries()].map(([wallet, weight]) => ({ wallet, weight }));
}

function pickWeighted(
  rows: WeightRow[],
  seedHex: string
): { winner: string; total: bigint; roll: bigint; winnerWeight: bigint } {
  const total = rows.reduce((a, r) => a + r.weight, BigInt(0));
  if (total <= BigInt(0)) throw new Error("Pot boş");
  const roll = BigInt(`0x${seedHex}`) % total;
  let acc = BigInt(0);
  for (const r of rows) {
    acc += r.weight;
    if (roll < acc) {
      return {
        winner: r.wallet,
        total,
        roll,
        winnerWeight: r.weight,
      };
    }
  }
  const last = rows[rows.length - 1]!;
  return {
    winner: last.wallet,
    total,
    roll,
    winnerWeight: last.weight,
  };
}

async function resetPot(key: string, expectedWei: string, expectedCount: number) {
  const empty: NearPlacePot = {
    geohash: key,
    totalWei: "0",
    giftCount: 0,
    updatedAt: now(),
  };
  pots().set(key, empty);
  g.__jiyNearPotEvents = events().filter((e) => e.geohash !== key);

  const client = await db();
  if (!client) return;

  const { data, error } = await client
    .from("near_place_pots")
    .update({
      total_wei: "0",
      gift_count: 0,
      updated_at: empty.updatedAt,
    })
    .eq("geohash", key)
    .eq("total_wei", expectedWei)
    .eq("gift_count", expectedCount)
    .select("geohash")
    .maybeSingle();

  if (error && isSchemaGap(error)) return;
  if (error) throw new Error(error.message || "pot reset failed");
  if (!data) throw new Error("Kasa değişti — çekilişi tekrar dene");

  await client.from("near_place_pot_events").delete().eq("geohash", key);
}

async function persistDraw(draw: PotDrawResult): Promise<void> {
  drawLog().unshift(draw);
  const client = await db();
  if (!client) return;
  const { error } = await client.from("near_pot_draws").insert({
    id: draw.id,
    geohash: draw.geohash,
    winner_wallet: draw.winnerWallet,
    entrants: draw.entrants,
    total_wei: draw.totalWei,
    payout_jiy: draw.payoutJiy,
    entropy_source: draw.entropySource,
    seed_commit: draw.seedCommit,
    seed_reveal: draw.seedReveal,
    proof: draw.proof,
    payout_status: draw.payoutStatus,
    created_at: draw.drawnAt,
  });
  if (error && !isSchemaGap(error)) {
    throw new Error(error.message || "draw persist failed");
  }
}

/**
 * Weighted night draw among pot contributors.
 * Entropy: commit-reveal (sha256) shaped for future Supra dVRF swap.
 * Winner receives claimable ledger JIY; pot resets.
 */
export async function drawPotWinner(geohash: string): Promise<PotDrawResult> {
  const key = geohash.slice(0, 5);
  const list = await recentPotEvents(key, 500);
  const weights = weightByContribution(list);
  if (weights.length < 2) {
    throw new Error("Çekiliş için en az 2 katılımcı gerekli");
  }

  const pot = await getPot(key);
  if (BigInt(pot.totalWei || "0") <= BigInt(0) || pot.giftCount < 1) {
    throw new Error("Kasa boş");
  }

  const seed = randomBytes(32).toString("hex");
  const seedCommit = sha256Hex(seed, true);
  const picked = pickWeighted(weights, seed);
  const payoutJiy = unitsToJiy(pot.totalWei);

  // Reset pot first (CAS) so a second draw cannot double-pay the same pool.
  await resetPot(key, pot.totalWei, pot.giftCount);

  let payoutStatus: PotDrawResult["payoutStatus"] = "credited";
  try {
    await creditWalletJiy(picked.winner, payoutJiy);
  } catch (err) {
    console.error("pot payout credit failed", err);
    payoutStatus = "failed";
  }

  const result: PotDrawResult = {
    id: nanoid(14),
    geohash: key,
    winnerWallet: picked.winner,
    entrants: weights.length,
    totalWei: pot.totalWei,
    payoutJiy,
    drawnAt: now(),
    entropySource: "commit-reveal",
    seedCommit,
    seedReveal: seed,
    proof: {
      algorithm: "weighted-contrib-mod-sha256-seed",
      totalWeight: picked.total.toString(),
      winnerWeight: picked.winnerWeight.toString(),
      roll: picked.roll.toString(),
    },
    payoutStatus,
  };
  await persistDraw(result);
  return result;
}

export async function lastDraw(geohash: string): Promise<PotDrawResult | null> {
  const key = geohash.slice(0, 5);
  const mem = drawLog().find((d) => d.geohash === key);
  if (mem) return mem;

  const client = await db();
  if (!client) return null;
  const { data, error } = await client
    .from("near_pot_draws")
    .select("*")
    .eq("geohash", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row: PotDrawResult = {
    id: data.id,
    geohash: data.geohash,
    winnerWallet: data.winner_wallet,
    entrants: data.entrants,
    totalWei: data.total_wei,
    payoutJiy: Number(data.payout_jiy),
    drawnAt: data.created_at,
    entropySource: data.entropy_source as PotDrawResult["entropySource"],
    seedCommit: data.seed_commit,
    seedReveal: data.seed_reveal,
    proof: (data.proof || {}) as PotDrawResult["proof"],
    payoutStatus: data.payout_status as PotDrawResult["payoutStatus"],
  };
  drawLog().unshift(row);
  return row;
}
