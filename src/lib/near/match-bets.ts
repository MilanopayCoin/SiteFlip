import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchMatchOdds,
  getCachedMatch,
  teamsStrictMatch,
  type MatchOdds,
} from "@/lib/near/odds";
import { jiyToUnits } from "@/lib/near/jiy-token";

export type BetCurrency = "jiy" | "supra";
export type BetPick = "home" | "draw" | "away";
export type BetStatus = "open" | "won" | "lost" | "void";

export type MatchBet = {
  id: string;
  wallet: string;
  matchId: string;
  league: string;
  home: string;
  away: string;
  kickoffUtc: string;
  pick: BetPick;
  odds: number;
  stake: number;
  currency: BetCurrency;
  potentialWin: number;
  status: BetStatus;
  scoreHome: number | null;
  scoreAway: number | null;
  txHash: string | null;
  createdAt: string;
  settledAt: string | null;
};

export type MatchBalances = {
  wallet: string;
  /** Demo / ledger SUPRA chips */
  supra: number;
  /** Claimable / ledger JIY */
  jiy: number;
};

const START_SUPRA = 2_000;
const START_JIY = 50;
/** Don't settle until kickoff + this many ms (regulation-ish). */
const SETTLE_AFTER_MS = 85 * 60_000;
/** Kickoff vs InferSports scheduled_at must be within this window. */
const KICKOFF_SLACK_MS = 12 * 3600_000;

const g = globalThis as unknown as {
  __jiyMatchBets?: MatchBet[];
  __jiyMatchBalances?: Map<string, MatchBalances>;
};

function bets() {
  if (!g.__jiyMatchBets) g.__jiyMatchBets = [];
  return g.__jiyMatchBets;
}
function balances() {
  if (!g.__jiyMatchBalances) g.__jiyMatchBalances = new Map();
  return g.__jiyMatchBalances;
}
function now() {
  return new Date().toISOString();
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

function parseAmount(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

function cacheBet(bet: MatchBet) {
  const list = bets();
  const idx = list.findIndex((b) => b.id === bet.id);
  if (idx >= 0) list[idx] = bet;
  else list.unshift(bet);
}

export async function getMatchBalances(
  wallet: string,
  opts?: { fresh?: boolean }
): Promise<MatchBalances> {
  const w = norm(wallet);
  if (!opts?.fresh) {
    const mem = balances().get(w);
    if (mem) return mem;
  }

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_match_balances")
      .select("*")
      .eq("wallet", w)
      .maybeSingle();
    if (!error && data) {
      const bal: MatchBalances = {
        wallet: w,
        // Preserve stored 0 — do not treat falsy as missing.
        supra: parseAmount(data.supra, START_SUPRA),
        jiy: parseAmount(data.jiy, 0),
      };
      balances().set(w, bal);
      return bal;
    }
    if (error && !isSchemaGap(error) && error.code !== "PGRST116") {
      // Fall through to grant only when row truly missing.
    }
  }

  const existing = balances().get(w);
  if (existing) return existing;

  const fresh: MatchBalances = {
    wallet: w,
    supra: START_SUPRA,
    jiy: START_JIY,
  };
  balances().set(w, fresh);
  await persistBalance(fresh);
  return fresh;
}

async function persistBalance(bal: MatchBalances): Promise<void> {
  balances().set(bal.wallet, bal);
  const client = await db();
  if (!client) return;
  const { error } = await client.from("near_match_balances").upsert({
    wallet: bal.wallet,
    supra: bal.supra,
    jiy: bal.jiy,
    updated_at: now(),
  });
  if (error && !isSchemaGap(error)) {
    console.error("near_match_balances", error.message);
  }
}

/**
 * Optimistic debit. Retries once. Fails closed on concurrent mutation.
 */
async function debitBalance(
  wallet: string,
  currency: BetCurrency,
  amount: number
): Promise<MatchBalances> {
  const w = norm(wallet);
  for (let attempt = 0; attempt < 2; attempt++) {
    const bal = await getMatchBalances(w, { fresh: true });
    const field = currency === "supra" ? "supra" : "jiy";
    if (bal[field] < amount) {
      throw new Error(
        currency === "supra" ? "Yetersiz SUPRA bakiyesi" : "Yetersiz JIY bakiyesi"
      );
    }
    const next =
      currency === "supra"
        ? Math.round((bal[field] - amount) * 1000) / 1000
        : Math.round((bal[field] - amount) * 1e6) / 1e6;

    const client = await db();
    if (!client) {
      bal[field] = next;
      balances().set(w, bal);
      return bal;
    }

    const { data, error } = await client
      .from("near_match_balances")
      .update({ [field]: next, updated_at: now() })
      .eq("wallet", w)
      .eq(field, bal[field])
      .gte(field, amount)
      .select("*")
      .maybeSingle();

    if (error && isSchemaGap(error)) {
      bal[field] = next;
      balances().set(w, bal);
      return bal;
    }
    if (data) {
      const out: MatchBalances = {
        wallet: w,
        supra: parseAmount(data.supra, field === "supra" ? next : bal.supra),
        jiy: parseAmount(data.jiy, field === "jiy" ? next : bal.jiy),
      };
      balances().set(w, out);
      return out;
    }
  }
  throw new Error("Eşzamanlı bakiye güncellemesi — tekrar dene");
}

/** Shared Near claimable JIY (match bets + pot payouts). */
export async function creditWalletJiy(
  wallet: string,
  amount: number
): Promise<MatchBalances> {
  return creditBalance(wallet, "jiy", amount);
}

/** Debit claimable JIY (ledger pot contributions when Move treasury unset). */
export async function debitWalletJiy(
  wallet: string,
  amount: number
): Promise<MatchBalances> {
  return debitBalance(wallet, "jiy", amount);
}

async function creditBalance(
  wallet: string,
  currency: BetCurrency,
  amount: number
): Promise<MatchBalances> {
  const w = norm(wallet);
  for (let attempt = 0; attempt < 3; attempt++) {
    const bal = await getMatchBalances(w, { fresh: true });
    const field = currency === "supra" ? "supra" : "jiy";
    const next =
      currency === "supra"
        ? Math.round((bal[field] + amount) * 1000) / 1000
        : Math.round((bal[field] + amount) * 1e6) / 1e6;

    const client = await db();
    if (!client) {
      bal[field] = next;
      balances().set(w, bal);
      return bal;
    }

    const { data, error } = await client
      .from("near_match_balances")
      .update({ [field]: next, updated_at: now() })
      .eq("wallet", w)
      .eq(field, bal[field])
      .select("*")
      .maybeSingle();

    if (error && isSchemaGap(error)) {
      bal[field] = next;
      balances().set(w, bal);
      return bal;
    }
    if (data) {
      const out: MatchBalances = {
        wallet: w,
        supra: parseAmount(data.supra, field === "supra" ? next : bal.supra),
        jiy: parseAmount(data.jiy, field === "jiy" ? next : bal.jiy),
      };
      balances().set(w, out);
      return out;
    }
  }
  throw new Error("Kazanç yazılamadı — tekrar dene");
}

async function persistBet(bet: MatchBet): Promise<void> {
  cacheBet(bet);
  const client = await db();
  if (!client) return;
  const { error } = await client.from("near_match_bets").upsert({
    id: bet.id,
    wallet: bet.wallet,
    match_id: bet.matchId,
    league: bet.league,
    home: bet.home,
    away: bet.away,
    kickoff_utc: bet.kickoffUtc,
    pick: bet.pick,
    odds: bet.odds,
    stake: bet.stake,
    currency: bet.currency,
    potential_win: bet.potentialWin,
    status: bet.status,
    score_home: bet.scoreHome,
    score_away: bet.scoreAway,
    tx_hash: bet.txHash,
    created_at: bet.createdAt,
    settled_at: bet.settledAt,
  });
  if (error && isSchemaGap(error)) return;
  if (error) {
    // Roll back in-memory cache — caller must not treat this as placed.
    const list = bets();
    const idx = list.findIndex((b) => b.id === bet.id);
    if (idx >= 0) list.splice(idx, 1);
    throw new Error(error.message || "Bahis kaydı yazılamadı");
  }
}

/** Claim open → terminal status atomically. Returns false if already settled. */
async function claimBetSettlement(
  betId: string,
  patch: {
    status: "won" | "lost" | "void";
    scoreHome: number | null;
    scoreAway: number | null;
    settledAt: string;
  }
): Promise<boolean> {
  const client = await db();
  if (!client) {
    const b = bets().find((x) => x.id === betId);
    if (!b || b.status !== "open") return false;
    b.status = patch.status;
    b.scoreHome = patch.scoreHome;
    b.scoreAway = patch.scoreAway;
    b.settledAt = patch.settledAt;
    return true;
  }

  const { data, error } = await client
    .from("near_match_bets")
    .update({
      status: patch.status,
      score_home: patch.scoreHome,
      score_away: patch.scoreAway,
      settled_at: patch.settledAt,
    })
    .eq("id", betId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    if (isSchemaGap(error)) {
      const b = bets().find((x) => x.id === betId);
      if (!b || b.status !== "open") return false;
      b.status = patch.status;
      b.scoreHome = patch.scoreHome;
      b.scoreAway = patch.scoreAway;
      b.settledAt = patch.settledAt;
      return true;
    }
    throw new Error(error.message || "settle claim failed");
  }
  return Boolean(data);
}

export async function listMatchBets(
  wallet: string,
  limit = 40
): Promise<MatchBet[]> {
  const w = norm(wallet);
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_match_bets")
      .select("*")
      .eq("wallet", w)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const mapped = data.map(rowToBet);
      for (const b of mapped) cacheBet(b);
      return mapped;
    }
    if (error && !isSchemaGap(error)) {
      console.error("listMatchBets", error.message);
    }
  }
  return bets()
    .filter((b) => b.wallet === w)
    .slice(0, limit);
}

function rowToBet(row: Record<string, unknown>): MatchBet {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    matchId: String(row.match_id),
    league: String(row.league),
    home: String(row.home),
    away: String(row.away),
    kickoffUtc: String(row.kickoff_utc),
    pick: row.pick as BetPick,
    odds: Number(row.odds),
    stake: Number(row.stake),
    currency: row.currency as BetCurrency,
    potentialWin: Number(row.potential_win),
    status: row.status as BetStatus,
    scoreHome: row.score_home == null ? null : Number(row.score_home),
    scoreAway: row.score_away == null ? null : Number(row.score_away),
    txHash: (row.tx_hash as string | null) || null,
    createdAt: String(row.created_at),
    settledAt: (row.settled_at as string | null) || null,
  };
}

export type PreparedMatchBet = {
  wallet: string;
  match: MatchOdds;
  pick: BetPick;
  stake: number;
  currency: BetCurrency;
  odds: number;
  potentialWin: number;
};

/**
 * Validate pick/stake/match/kickoff before any Move spend or ledger debit.
 * Call this before verify/consumeMoveTx so a failed quote cannot burn a tx.
 */
export async function prepareMatchBet(input: {
  wallet: string;
  matchId: string;
  pick: BetPick;
  stake: number;
  currency: BetCurrency;
}): Promise<PreparedMatchBet> {
  if (!["home", "draw", "away"].includes(input.pick)) {
    throw new Error("Geçersiz seçim (1/X/2)");
  }
  if (!["jiy", "supra"].includes(input.currency)) {
    throw new Error("Para birimi jiy veya supra olmalı");
  }
  if (!Number.isFinite(input.stake) || input.stake <= 0) {
    throw new Error("Geçersiz stake");
  }
  if (input.currency === "jiy" && input.stake > 10_000) {
    throw new Error("Max 10.000 JIY");
  }
  if (input.currency === "supra" && input.stake > 50_000) {
    throw new Error("Max 50.000 SUPRA");
  }

  // Always refresh odds for placement — avoid stale cache removing the match
  // between client pay and server place.
  const { matches } = await fetchMatchOdds(80);
  const match =
    matches.find((m) => m.id === input.matchId) ||
    getCachedMatch(input.matchId);
  if (!match) throw new Error("Maç bulunamadı / oranlar yenilendi");

  const kickoff = new Date(match.kickoffUtc).getTime();
  if (Number.isFinite(kickoff) && kickoff < Date.now() - 60_000) {
    throw new Error("Maç başladı — bahis kapalı");
  }

  const odds = match.odds[input.pick];
  if (!odds || odds < 1.01) throw new Error("Oran geçersiz");

  const potentialWin =
    Math.round(input.stake * odds * (input.currency === "jiy" ? 1e6 : 1000)) /
    (input.currency === "jiy" ? 1e6 : 1000);

  return {
    wallet: norm(input.wallet),
    match,
    pick: input.pick,
    stake: input.stake,
    currency: input.currency,
    odds,
    potentialWin,
  };
}

/** Debit ledger (if needed) and persist. Refunds ledger debit if persist fails. */
export async function commitMatchBet(
  prepared: PreparedMatchBet,
  txHash?: string | null
): Promise<{ bet: MatchBet; balances: MatchBalances }> {
  let bal: MatchBalances;
  let ledgerDebit: { currency: BetCurrency; amount: number } | null = null;
  if (prepared.currency === "supra") {
    bal = await debitBalance(prepared.wallet, "supra", prepared.stake);
    ledgerDebit = { currency: "supra", amount: prepared.stake };
  } else if (!txHash) {
    bal = await debitBalance(prepared.wallet, "jiy", prepared.stake);
    ledgerDebit = { currency: "jiy", amount: prepared.stake };
  } else {
    bal = await getMatchBalances(prepared.wallet, { fresh: true });
  }

  const bet: MatchBet = {
    id: nanoid(14),
    wallet: prepared.wallet,
    matchId: prepared.match.id,
    league: prepared.match.league,
    home: prepared.match.home,
    away: prepared.match.away,
    kickoffUtc: prepared.match.kickoffUtc,
    pick: prepared.pick,
    odds: prepared.odds,
    stake: prepared.stake,
    currency: prepared.currency,
    potentialWin: prepared.potentialWin,
    status: "open",
    scoreHome: null,
    scoreAway: null,
    txHash: txHash || null,
    createdAt: now(),
    settledAt: null,
  };
  try {
    await persistBet(bet);
  } catch (err) {
    if (ledgerDebit) {
      try {
        await creditBalance(
          prepared.wallet,
          ledgerDebit.currency,
          ledgerDebit.amount
        );
      } catch (refundErr) {
        console.error("bet persist refund failed", refundErr);
      }
    }
    throw err;
  }
  return { bet, balances: bal };
}

export async function placeMatchBet(input: {
  wallet: string;
  matchId: string;
  pick: BetPick;
  stake: number;
  currency: BetCurrency;
  txHash?: string | null;
}): Promise<{ bet: MatchBet; balances: MatchBalances }> {
  const prepared = await prepareMatchBet(input);
  return commitMatchBet(prepared, input.txHash);
}

type InferResult = {
  event_id: string;
  sport: string;
  league?: string;
  home_team: string;
  away_team: string;
  scheduled_at: string;
  finished_at?: string | null;
  score?: { home: number; away: number };
};

async function fetchInferResults(): Promise<InferResult[]> {
  const res = await fetch("https://api.infersports.dev/v1/results", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: InferResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

function pickResult(
  bet: MatchBet,
  results: InferResult[]
): { home: number; away: number } | null {
  const kickoff = Date.parse(bet.kickoffUtc);
  if (!Number.isFinite(kickoff)) return null;
  if (Date.now() < kickoff + SETTLE_AFTER_MS) return null;

  const candidates: InferResult[] = [];
  for (const r of results) {
    if (r.sport !== "football" || !r.score) continue;
    if (
      !Number.isFinite(r.score.home) ||
      !Number.isFinite(r.score.away)
    ) {
      continue;
    }
    const sched = Date.parse(r.scheduled_at);
    if (!Number.isFinite(sched)) continue;
    if (Math.abs(sched - kickoff) > KICKOFF_SLACK_MS) continue;
    if (r.finished_at) {
      const fin = Date.parse(r.finished_at);
      if (Number.isFinite(fin) && fin < kickoff) continue;
    }
    if (
      !teamsStrictMatch(bet.home, r.home_team) ||
      !teamsStrictMatch(bet.away, r.away_team)
    ) {
      continue;
    }
    candidates.push(r);
  }

  // Ambiguous fuzzy collisions must not settle.
  if (candidates.length !== 1) return null;
  const score = candidates[0]!.score!;
  return { home: score.home, away: score.away };
}

function outcomeOf(score: { home: number; away: number }): BetPick {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return "draw";
}

async function loadOpenBets(wallet?: string | null): Promise<MatchBet[]> {
  const w = wallet ? norm(wallet) : null;
  const client = await db();
  if (client) {
    let q = client
      .from("near_match_bets")
      .select("*")
      .eq("status", "open")
      .limit(100);
    if (w) q = q.eq("wallet", w);
    const { data, error } = await q;
    if (!error && data) {
      const mapped = data.map(rowToBet);
      for (const b of mapped) cacheBet(b);
      return mapped;
    }
    if (error && !isSchemaGap(error)) {
      throw new Error(error.message || "open bets load failed");
    }
  }
  return bets().filter((b) => b.status === "open" && (!w || b.wallet === w));
}

export async function settleOpenBets(wallet?: string): Promise<{
  settled: MatchBet[];
  balances: MatchBalances | null;
}> {
  const w = wallet ? norm(wallet) : null;
  const open = await loadOpenBets(w);

  if (!open.length) {
    return {
      settled: [],
      balances: w ? await getMatchBalances(w, { fresh: true }) : null,
    };
  }

  const results = await fetchInferResults();
  const settled: MatchBet[] = [];
  const touchedWallets = new Set<string>();

  for (const bet of open) {
    const score = pickResult(bet, results);
    if (!score) continue;
    const outcome = outcomeOf(score);
    const status: "won" | "lost" = outcome === bet.pick ? "won" : "lost";
    const settledAt = now();

    const claimed = await claimBetSettlement(bet.id, {
      status,
      scoreHome: score.home,
      scoreAway: score.away,
      settledAt,
    });
    if (!claimed) continue;

    bet.status = status;
    bet.scoreHome = score.home;
    bet.scoreAway = score.away;
    bet.settledAt = settledAt;
    cacheBet(bet);

    if (status === "won") {
      await creditBalance(bet.wallet, bet.currency, bet.potentialWin);
      touchedWallets.add(bet.wallet);
    }
    settled.push(bet);
  }

  return {
    settled,
    balances: w
      ? await getMatchBalances(w, { fresh: true })
      : touchedWallets.size === 1
        ? await getMatchBalances([...touchedWallets][0]!, { fresh: true })
        : null,
  };
}

/** Units helper for on-chain JIY stake verification. */
export function stakeJiyUnits(stake: number): string {
  return jiyToUnits(stake);
}

export type { MatchOdds };
