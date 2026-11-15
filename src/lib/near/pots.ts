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

/**
 * CAS contribute: only writes if total_wei/gift_count still match the read.
 * Prevents a stale contribute from restoring a drawn pot.
 */
export async function contributeToPot(input: {
  geohash: string;
  fromWallet: string;
  giftId: string;
  txHash: string | null;
}): Promise<NearPlacePot> {
  const gift = getGift(input.giftId);
  if (!gift) throw new Error("Unknown gift");
  const key = input.geohash.slice(0, 5);
  const amountWei = supraToWei(gift.amountJiy);

  for (let attempt = 0; attempt < 4; attempt++) {
    const pot = await getPot(key);
    const prevWei = pot.totalWei;
    const prevCount = pot.giftCount;
    const nextWei = (BigInt(prevWei) + BigInt(amountWei)).toString();
    const nextCount = prevCount + 1;
    const updatedAt = now();

    const ev = {
      id: nanoid(16),
      geohash: key,
      fromWallet: input.fromWallet.toLowerCase(),
      giftId: input.giftId,
      amountWei,
      txHash: input.txHash,
      createdAt: updatedAt,
    };

    const client = await db();
    if (!client) {
      const next: NearPlacePot = {
        geohash: key,
        totalWei: nextWei,
        giftCount: nextCount,
        updatedAt,
      };
      pots().set(key, next);
      events().unshift(ev);
      return next;
    }

    // Ensure row exists for CAS update.
    if (prevCount === 0 && prevWei === "0") {
      const { data: existing } = await client
        .from("near_place_pots")
        .select("geohash")
        .eq("geohash", key)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await client.from("near_place_pots").insert({
          geohash: key,
          total_wei: nextWei,
          gift_count: nextCount,
          updated_at: updatedAt,
        });
        if (insErr && !isSchemaGap(insErr) && insErr.code !== "23505") {
          throw new Error(insErr.message || "pot insert failed");
        }
        if (insErr?.code === "23505") continue; // raced create — retry CAS
        if (!insErr || isSchemaGap(insErr)) {
          if (!isSchemaGap(insErr || null)) {
            const { error: evErr } = await client
              .from("near_place_pot_events")
              .insert({
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
          const next: NearPlacePot = {
            geohash: key,
            totalWei: nextWei,
            giftCount: nextCount,
            updatedAt,
          };
          pots().set(key, next);
          events().unshift(ev);
          return next;
        }
      }
    }

    const { data, error } = await client
      .from("near_place_pots")
      .update({
        total_wei: nextWei,
        gift_count: nextCount,
        updated_at: updatedAt,
      })
      .eq("geohash", key)
      .eq("total_wei", prevWei)
      .eq("gift_count", prevCount)
      .select("*")
      .maybeSingle();

    if (error && isSchemaGap(error)) {
      const next: NearPlacePot = {
        geohash: key,
        totalWei: nextWei,
        giftCount: nextCount,
        updatedAt,
      };
      pots().set(key, next);
      events().unshift(ev);
      return next;
    }
    if (error) throw new Error(error.message || "pot CAS failed");
    if (!data) continue; // lost race — retry

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
      // Best-effort rollback of pot increment
      await client
        .from("near_place_pots")
        .update({
          total_wei: prevWei,
          gift_count: prevCount,
          updated_at: now(),
        })
        .eq("geohash", key)
        .eq("total_wei", nextWei)
        .eq("gift_count", nextCount);
      throw new Error(evErr.message || "pot event insert failed");
    }

    const next: NearPlacePot = {
      geohash: key,
      totalWei: String(data.total_wei),
      giftCount: Number(data.gift_count),
      updatedAt: data.updated_at,
    };
    pots().set(key, next);
    events().unshift(ev);
    return next;
  }
  throw new Error("Kasa meşgul — katkıyı tekrar dene");
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

function mapEventRow(row: Record<string, unknown>): PotEvent {
  return {
    id: String(row.id),
    geohash: String(row.geohash),
    fromWallet: String(row.from_wallet).toLowerCase(),
    giftId: String(row.gift_id),
    amountWei: String(row.amount_wei),
    txHash: (row.tx_hash as string | null) || null,
    createdAt: String(row.created_at),
  };
}

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
      return data.map((row) => mapEventRow(row as Record<string, unknown>));
    }
    if (error && !isSchemaGap(error)) {
      throw new Error(error.message || "pot events load failed");
    }
  }
  return events().filter((e) => e.geohash === key).slice(0, limit);
}

/** Load every contribution for a pot (paginated) — required for fair weighted draw. */
export async function allPotEvents(geohash: string): Promise<PotEvent[]> {
  const key = geohash.slice(0, 5);
  const client = await db();
  if (client) {
    const out: PotEvent[] = [];
    const page = 500;
    for (let offset = 0; offset < 20_000; offset += page) {
      const { data, error } = await client
        .from("near_place_pot_events")
        .select("*")
        .eq("geohash", key)
        .order("created_at", { ascending: true })
        .range(offset, offset + page - 1);
      if (error) {
        if (isSchemaGap(error)) break;
        throw new Error(error.message || "pot events page failed");
      }
      const rows = data || [];
      for (const row of rows) out.push(mapEventRow(row as Record<string, unknown>));
      if (rows.length < page) break;
    }
    if (out.length) return out;
  }
  return events()
    .filter((e) => e.geohash === key)
    .slice()
    .reverse();
}

export type PotDrawResult = {
  id: string;
  geohash: string;
  winnerWallet: string;
  entrants: number;
  totalWei: string;
  payoutJiy: number;
  drawnAt: string;
  entropySource: "commit-reveal" | "supra-dvrf";
  seedCommit: string;
  seedReveal: string;
  proof: {
    algorithm: string;
    totalWeight: string;
    winnerWeight: string;
    roll: string;
    eventCount: number;
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

async function resetPot(
  key: string,
  expectedWei: string,
  expectedCount: number
): Promise<void> {
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

async function restorePot(
  key: string,
  snapshot: NearPlacePot,
  snapshotEvents: PotEvent[]
): Promise<void> {
  pots().set(key, snapshot);
  for (const e of snapshotEvents) {
    if (!events().some((x) => x.id === e.id)) events().unshift(e);
  }
  const client = await db();
  if (!client) return;
  await client.from("near_place_pots").upsert({
    geohash: key,
    total_wei: snapshot.totalWei,
    gift_count: snapshot.giftCount,
    updated_at: snapshot.updatedAt,
  });
  if (snapshotEvents.length) {
    await client.from("near_place_pot_events").upsert(
      snapshotEvents.map((e) => ({
        id: e.id,
        geohash: e.geohash,
        from_wallet: e.fromWallet,
        gift_id: e.giftId,
        amount_wei: e.amountWei,
        tx_hash: e.txHash,
        created_at: e.createdAt,
      }))
    );
  }
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
 * Winner receives claimable ledger JIY; pot resets after successful credit.
 */
export async function drawPotWinner(geohash: string): Promise<PotDrawResult> {
  const key = geohash.slice(0, 5);
  const list = await allPotEvents(key);
  const weights = weightByContribution(list);
  if (weights.length < 2) {
    throw new Error("Çekiliş için en az 2 katılımcı gerekli");
  }

  const pot = await getPot(key);
  const potWei = BigInt(pot.totalWei || "0");
  if (potWei <= BigInt(0) || pot.giftCount < 1) {
    throw new Error("Kasa boş");
  }

  const weightSum = weights.reduce((a, r) => a + r.weight, BigInt(0));
  if (weightSum !== potWei) {
    throw new Error(
      "Kasa / katkı tutarsız — çekiliş iptal (tüm event’ler pot total ile eşleşmeli)"
    );
  }
  if (list.length !== pot.giftCount) {
    throw new Error(
      `Kasa sayacı tutarsız (${list.length} event / ${pot.giftCount} count)`
    );
  }

  const seed = randomBytes(32).toString("hex");
  const seedCommit = sha256Hex(seed, true);
  const picked = pickWeighted(weights, seed);
  const payoutJiy = unitsToJiy(pot.totalWei);
  const snapshot: NearPlacePot = { ...pot };
  const snapshotEvents = list.slice();

  // Claim pot (CAS) before credit so a second draw cannot pay the same pool.
  await resetPot(key, pot.totalWei, pot.giftCount);

  try {
    await creditWalletJiy(picked.winner, payoutJiy);
  } catch (err) {
    console.error("pot payout credit failed — restoring pot", err);
    try {
      await restorePot(key, snapshot, snapshotEvents);
    } catch (restoreErr) {
      console.error("pot restore failed", restoreErr);
    }
    throw new Error(
      err instanceof Error
        ? `Ödeme başarısız — kasa geri yüklendi: ${err.message}`
        : "Ödeme başarısız — kasa geri yüklendi"
    );
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
      eventCount: list.length,
    },
    payoutStatus: "credited",
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
