import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchMatchOdds,
  getCachedMatch,
  teamsLikelyMatch,
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

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function getMatchBalances(wallet: string): Promise<MatchBalances> {
  const w = norm(wallet);
  const mem = balances().get(w);
  if (mem) return mem;

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
        supra: Number(data.supra) || START_SUPRA,
        jiy: Number(data.jiy) || 0,
      };
      balances().set(w, bal);
      return bal;
    }
  }

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

async function persistBet(bet: MatchBet): Promise<void> {
  const list = bets();
  const idx = list.findIndex((b) => b.id === bet.id);
  if (idx >= 0) list[idx] = bet;
  else list.unshift(bet);

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
  if (error && !isSchemaGap(error)) {
    console.error("near_match_bets", error.message);
  }
}

export async function listMatchBets(
  wallet: string,
  limit = 40
): Promise<MatchBet[]> {
  const w = norm(wallet);
  const mem = bets().filter((b) => b.wallet === w);
  if (mem.length) return mem.slice(0, limit);

  const client = await db();
  if (!client) return [];
  const { data, error } = await client
    .from("near_match_bets")
    .select("*")
    .eq("wallet", w)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error && isSchemaGap(error)) return [];
  return (data || []).map(rowToBet);
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

export async function placeMatchBet(input: {
  wallet: string;
  matchId: string;
  pick: BetPick;
  stake: number;
  currency: BetCurrency;
  txHash?: string | null;
}): Promise<{ bet: MatchBet; balances: MatchBalances }> {
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

  let match = getCachedMatch(input.matchId);
  if (!match) {
    const { matches } = await fetchMatchOdds(80);
    match = matches.find((m) => m.id === input.matchId) || null;
  }
  if (!match) throw new Error("Maç bulunamadı / oranlar yenilendi");

  const kickoff = new Date(match.kickoffUtc).getTime();
  if (Number.isFinite(kickoff) && kickoff < Date.now() - 60_000) {
    throw new Error("Maç başladı — bahis kapalı");
  }

  const odds = match.odds[input.pick];
  if (!odds || odds < 1.01) throw new Error("Oran geçersiz");

  const bal = await getMatchBalances(input.wallet);
  if (input.currency === "supra") {
    if (bal.supra < input.stake) throw new Error("Yetersiz SUPRA bakiyesi");
    bal.supra = Math.round((bal.supra - input.stake) * 1000) / 1000;
  } else {
    // JIY: if on-chain tx provided, stake is already paid to treasury — don't
    // also debit ledger. Without tx, debit ledger JIY.
    if (!input.txHash) {
      if (bal.jiy < input.stake) throw new Error("Yetersiz JIY bakiyesi");
      bal.jiy = Math.round((bal.jiy - input.stake) * 1e6) / 1e6;
    }
  }
  await persistBalance(bal);

  const potentialWin =
    Math.round(input.stake * odds * (input.currency === "jiy" ? 1e6 : 1000)) /
    (input.currency === "jiy" ? 1e6 : 1000);

  const bet: MatchBet = {
    id: nanoid(14),
    wallet: norm(input.wallet),
    matchId: match.id,
    league: match.league,
    home: match.home,
    away: match.away,
    kickoffUtc: match.kickoffUtc,
    pick: input.pick,
    odds,
    stake: input.stake,
    currency: input.currency,
    potentialWin,
    status: "open",
    scoreHome: null,
    scoreAway: null,
    txHash: input.txHash || null,
    createdAt: now(),
    settledAt: null,
  };
  await persistBet(bet);
  return { bet, balances: bal };
}

type InferResult = {
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  scheduled_at: string;
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
  const football = results.filter((r) => r.sport === "football" && r.score);
  for (const r of football) {
    if (
      teamsLikelyMatch(bet.home, r.home_team) &&
      teamsLikelyMatch(bet.away, r.away_team)
    ) {
      return { home: r.score!.home, away: r.score!.away };
    }
  }
  return null;
}

function outcomeOf(score: { home: number; away: number }): BetPick {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return "draw";
}

export async function settleOpenBets(wallet?: string): Promise<{
  settled: MatchBet[];
  balances: MatchBalances | null;
}> {
  const w = wallet ? norm(wallet) : null;
  let open = bets().filter((b) => b.status === "open" && (!w || b.wallet === w));

  if (!open.length) {
    const client = await db();
    if (client) {
      let q = client
        .from("near_match_bets")
        .select("*")
        .eq("status", "open")
        .limit(100);
      if (w) q = q.eq("wallet", w);
      const { data } = await q;
      open = (data || []).map(rowToBet);
      for (const b of open) {
        if (!bets().some((x) => x.id === b.id)) bets().unshift(b);
      }
    }
  }

  if (!open.length) {
    return {
      settled: [],
      balances: w ? await getMatchBalances(w) : null,
    };
  }

  const results = await fetchInferResults();
  const settled: MatchBet[] = [];
  const touchedWallets = new Set<string>();

  for (const bet of open) {
    const score = pickResult(bet, results);
    if (!score) continue;
    const outcome = outcomeOf(score);
    bet.scoreHome = score.home;
    bet.scoreAway = score.away;
    bet.settledAt = now();
    if (outcome === bet.pick) {
      bet.status = "won";
      const bal = await getMatchBalances(bet.wallet);
      if (bet.currency === "supra") {
        bal.supra =
          Math.round((bal.supra + bet.potentialWin) * 1000) / 1000;
      } else {
        bal.jiy = Math.round((bal.jiy + bet.potentialWin) * 1e6) / 1e6;
      }
      await persistBalance(bal);
      touchedWallets.add(bet.wallet);
    } else {
      bet.status = "lost";
    }
    await persistBet(bet);
    settled.push(bet);
  }

  return {
    settled,
    balances: w
      ? await getMatchBalances(w)
      : touchedWallets.size === 1
        ? await getMatchBalances([...touchedWallets][0]!)
        : null,
  };
}

/** Units helper for on-chain JIY stake verification. */
export function stakeJiyUnits(stake: number): string {
  return jiyToUnits(stake);
}

export type { MatchOdds };
