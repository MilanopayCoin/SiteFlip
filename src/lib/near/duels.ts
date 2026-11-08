import { nanoid } from "nanoid";
import { giftScore } from "@/lib/near/gifts";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export type NearDuelStatus = "pending" | "active" | "done" | "declined";

export type NearDuel = {
  id: string;
  aWallet: string;
  bWallet: string;
  aScore: number;
  bScore: number;
  status: NearDuelStatus;
  winnerWallet: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

const DUEL_SECONDS = 60;

const g = globalThis as unknown as {
  __jiyNearDuels?: Map<string, NearDuel>;
};

function duels() {
  if (!g.__jiyNearDuels) g.__jiyNearDuels = new Map();
  return g.__jiyNearDuels;
}

function now() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function norm(w: string) {
  return w.trim().toLowerCase();
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

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function finalizeIfNeeded(d: NearDuel): NearDuel {
  if (d.status !== "active" || !d.endsAt) return d;
  if (new Date(d.endsAt).getTime() > nowMs()) return d;
  let winner: string | null = null;
  if (d.aScore > d.bScore) winner = d.aWallet;
  else if (d.bScore > d.aScore) winner = d.bWallet;
  const done: NearDuel = {
    ...d,
    status: "done",
    winnerWallet: winner,
  };
  duels().set(done.id, done);
  void persistDuel(done);
  return done;
}

async function persistDuel(d: NearDuel) {
  const client = await db();
  if (!client) return;
  const { error } = await client.from("near_duels").upsert({
    id: d.id,
    a_wallet: d.aWallet,
    b_wallet: d.bWallet,
    a_score: d.aScore,
    b_score: d.bScore,
    status: d.status,
    winner_wallet: d.winnerWallet,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    created_at: d.createdAt,
  });
  if (error && !isSchemaGap(error)) {
    console.warn("[near.duels]", error.message);
  }
}

function rowToDuel(row: Record<string, unknown>): NearDuel {
  return {
    id: String(row.id),
    aWallet: String(row.a_wallet),
    bWallet: String(row.b_wallet),
    aScore: Number(row.a_score) || 0,
    bScore: Number(row.b_score) || 0,
    status: row.status as NearDuelStatus,
    winnerWallet: (row.winner_wallet as string) || null,
    startsAt: (row.starts_at as string) || null,
    endsAt: (row.ends_at as string) || null,
    createdAt: String(row.created_at),
  };
}

export async function challengeDuel(
  fromWallet: string,
  toWallet: string
): Promise<NearDuel> {
  const a = norm(fromWallet);
  const b = norm(toWallet);
  if (a === b) throw new Error("Cannot duel yourself");

  // Block duplicate open duels between same pair
  for (const d of duels().values()) {
    const fin = finalizeIfNeeded(d);
    if (fin.status === "done" || fin.status === "declined") continue;
    const [x, y] = pair(fin.aWallet, fin.bWallet);
    const [p, q] = pair(a, b);
    if (x === p && y === q) return fin;
  }

  const rec: NearDuel = {
    id: nanoid(14),
    aWallet: a,
    bWallet: b,
    aScore: 0,
    bScore: 0,
    status: "pending",
    winnerWallet: null,
    startsAt: null,
    endsAt: null,
    createdAt: now(),
  };
  duels().set(rec.id, rec);
  await persistDuel(rec);
  return rec;
}

export async function acceptDuel(
  duelId: string,
  wallet: string
): Promise<NearDuel> {
  const w = norm(wallet);
  let d = duels().get(duelId) || (await loadDuel(duelId));
  if (!d) throw new Error("Duel not found");
  d = finalizeIfNeeded(d);
  if (d.status !== "pending") throw new Error("Duel not pending");
  if (d.bWallet !== w) throw new Error("Only challenged wallet can accept");
  const startsAt = now();
  const endsAt = new Date(nowMs() + DUEL_SECONDS * 1000).toISOString();
  const active: NearDuel = {
    ...d,
    status: "active",
    startsAt,
    endsAt,
  };
  duels().set(active.id, active);
  await persistDuel(active);
  return active;
}

export async function declineDuel(
  duelId: string,
  wallet: string
): Promise<NearDuel> {
  const w = norm(wallet);
  let d = duels().get(duelId) || (await loadDuel(duelId));
  if (!d) throw new Error("Duel not found");
  if (d.bWallet !== w) throw new Error("Only challenged wallet can decline");
  if (d.status !== "pending") throw new Error("Duel not pending");
  const declined: NearDuel = { ...d, status: "declined" };
  duels().set(declined.id, declined);
  await persistDuel(declined);
  return declined;
}

async function loadDuel(id: string): Promise<NearDuel | null> {
  const mem = duels().get(id);
  if (mem) return finalizeIfNeeded(mem);
  const client = await db();
  if (!client) return null;
  const { data, error } = await client
    .from("near_duels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error && isSchemaGap(error)) return null;
  if (!data) return null;
  const d = finalizeIfNeeded(rowToDuel(data));
  duels().set(d.id, d);
  return d;
}

export async function getDuel(id: string): Promise<NearDuel | null> {
  return loadDuel(id);
}

export async function listDuelsFor(wallet: string): Promise<NearDuel[]> {
  const w = norm(wallet);
  const out = new Map<string, NearDuel>();

  for (const d of duels().values()) {
    const fin = finalizeIfNeeded(d);
    if (fin.aWallet === w || fin.bWallet === w) out.set(fin.id, fin);
  }

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_duels")
      .select("*")
      .or(`a_wallet.eq.${w},b_wallet.eq.${w}`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (!error || !isSchemaGap(error)) {
      for (const row of data || []) {
        const d = finalizeIfNeeded(rowToDuel(row));
        duels().set(d.id, d);
        out.set(d.id, d);
      }
    }
  }

  return [...out.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Credit gift score to sender if an active duel exists with the recipient.
 * Call from recordGift (A→B gift → A's score in A↔B duel).
 */
export async function creditDuelGift(input: {
  fromWallet: string;
  toWallet: string;
  giftId: string;
}): Promise<NearDuel | null> {
  const from = norm(input.fromWallet);
  const to = norm(input.toWallet);
  const pts = giftScore(input.giftId);
  if (pts <= 0) return null;

  let hit: NearDuel | null = null;
  for (const d of duels().values()) {
    const fin = finalizeIfNeeded(d);
    if (fin.status !== "active") continue;
    const pairOk =
      (fin.aWallet === from && fin.bWallet === to) ||
      (fin.aWallet === to && fin.bWallet === from);
    if (!pairOk) continue;
    hit = fin;
    break;
  }

  if (!hit) {
    const client = await db();
    if (client) {
      const { data, error } = await client
        .from("near_duels")
        .select("*")
        .eq("status", "active")
        .or(`a_wallet.eq.${from},b_wallet.eq.${from}`)
        .limit(20);
      if (!error || !isSchemaGap(error)) {
        for (const row of data || []) {
          const fin = finalizeIfNeeded(rowToDuel(row));
          duels().set(fin.id, fin);
          if (fin.status !== "active") continue;
          if (
            (fin.aWallet === from && fin.bWallet === to) ||
            (fin.aWallet === to && fin.bWallet === from)
          ) {
            hit = fin;
            break;
          }
        }
      }
    }
  }

  if (!hit || hit.status !== "active") return null;

  const next: NearDuel = { ...hit };
  if (next.aWallet === from) next.aScore += pts;
  else if (next.bWallet === from) next.bScore += pts;
  else return null;

  duels().set(next.id, next);
  const fin = finalizeIfNeeded(next);
  await persistDuel(fin);
  return fin;
}

export { DUEL_SECONDS };
