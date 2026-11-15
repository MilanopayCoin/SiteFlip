/** Free match odds via TipsAudit fair-odds API (attribution required). */

export const ODDS_ATTRIBUTION = {
  name: "TipsAudit",
  url: "https://tipsaudit.com",
  html: '<a href="https://tipsaudit.com">Data: TipsAudit</a>',
} as const;

export type MatchOdds = {
  id: string;
  source: "tipsaudit";
  league: string;
  home: string;
  away: string;
  kickoffUtc: string;
  /** Decimal house odds 1X2 (~4% edge vs fair) */
  odds: { home: number; draw: number; away: number };
  /** Fair probabilities from TipsAudit (0–1) */
  probabilities: { home: number; draw: number; away: number };
  /** Implied from house odds (sums > 1 due to margin) */
  implied: { home: number; draw: number; away: number };
  /** Minutes until kickoff (negative if started) */
  minutesToKick: number;
  /** starting_soon < 3h | today | upcoming */
  bucket: "starting_soon" | "today" | "upcoming" | "started";
  status: string;
  url: string;
};

export type LeagueStat = { name: string; count: number };

export type MarketOverview = {
  events: number;
  leagues: number;
  startingSoon: number;
  today: number;
  fetchedAt: string;
  cached: boolean;
};

type TipsAuditPrediction = {
  id: number;
  league: string;
  home: string;
  away: string;
  kickoff_utc: string;
  fair_odds?: { home: number; draw: number; away: number };
  fair_probabilities?: { home: number; draw: number; away: number };
  status?: string;
  url?: string;
};

const g = globalThis as unknown as {
  __jiyOddsCache?: { at: number; matches: MatchOdds[] };
};

const CACHE_MS = 45_000;

function houseOdds(fair: number): number {
  const o = fair * 0.96;
  return Math.max(1.01, Math.round(o * 100) / 100);
}

function impliedFromOdds(o: number): number {
  if (!Number.isFinite(o) || o <= 1) return 0;
  return Math.round((1 / o) * 10_000) / 10_000;
}

function bucketFor(kickoffUtc: string, nowMs: number): MatchOdds["bucket"] {
  const t = Date.parse(kickoffUtc);
  if (!Number.isFinite(t)) return "upcoming";
  const mins = (t - nowMs) / 60_000;
  if (mins < -5) return "started";
  if (mins <= 180) return "starting_soon";
  const endToday = new Date(nowMs);
  endToday.setUTCHours(23, 59, 59, 999);
  if (t <= endToday.getTime()) return "today";
  return "upcoming";
}

function enrich(
  p: TipsAuditPrediction,
  nowMs: number
): MatchOdds | null {
  if (!p.fair_odds?.home || !p.fair_odds.draw || !p.fair_odds.away) return null;
  const odds = {
    home: houseOdds(p.fair_odds.home),
    draw: houseOdds(p.fair_odds.draw),
    away: houseOdds(p.fair_odds.away),
  };
  const kick = Date.parse(p.kickoff_utc);
  const minutesToKick = Number.isFinite(kick)
    ? Math.round((kick - nowMs) / 60_000)
    : 0;
  return {
    id: `ta-${p.id}`,
    source: "tipsaudit",
    league: p.league || "Football",
    home: p.home,
    away: p.away,
    kickoffUtc: p.kickoff_utc,
    odds,
    probabilities: {
      home: p.fair_probabilities?.home ?? 0,
      draw: p.fair_probabilities?.draw ?? 0,
      away: p.fair_probabilities?.away ?? 0,
    },
    implied: {
      home: impliedFromOdds(odds.home),
      draw: impliedFromOdds(odds.draw),
      away: impliedFromOdds(odds.away),
    },
    minutesToKick,
    bucket: bucketFor(p.kickoff_utc, nowMs),
    status: p.status || "none",
    url: p.url || ODDS_ATTRIBUTION.url,
  };
}

export async function fetchMatchOdds(limit = 80): Promise<{
  matches: MatchOdds[];
  leagues: LeagueStat[];
  overview: MarketOverview;
  attribution: typeof ODDS_ATTRIBUTION;
  fetchedAt: string;
  cached: boolean;
}> {
  const now = Date.now();
  if (g.__jiyOddsCache && now - g.__jiyOddsCache.at < CACHE_MS) {
    const all = g.__jiyOddsCache.matches.map((m) => ({
      ...m,
      minutesToKick: Math.round(
        (Date.parse(m.kickoffUtc) - now) / 60_000
      ),
      bucket: bucketFor(m.kickoffUtc, now),
    }));
    return packageOdds(all, limit, new Date(g.__jiyOddsCache.at).toISOString(), true);
  }

  const res = await fetch("https://tipsaudit.com/api/v1/predictions", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Odds API ${res.status}`);
  }
  const data = (await res.json()) as { predictions?: TipsAuditPrediction[] };
  const preds = Array.isArray(data.predictions) ? data.predictions : [];
  const matches: MatchOdds[] = [];
  for (const p of preds) {
    const m = enrich(p, now);
    if (m) matches.push(m);
  }
  matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  g.__jiyOddsCache = { at: now, matches };
  return packageOdds(matches, limit, new Date(now).toISOString(), false);
}

function packageOdds(
  all: MatchOdds[],
  limit: number,
  fetchedAt: string,
  cached: boolean
) {
  const open = all.filter((m) => m.bucket !== "started");
  const leagueMap = new Map<string, number>();
  for (const m of open) {
    leagueMap.set(m.league, (leagueMap.get(m.league) || 0) + 1);
  }
  const leagues: LeagueStat[] = [...leagueMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const overview: MarketOverview = {
    events: open.length,
    leagues: leagues.length,
    startingSoon: open.filter((m) => m.bucket === "starting_soon").length,
    today: open.filter((m) => m.bucket === "today" || m.bucket === "starting_soon")
      .length,
    fetchedAt,
    cached,
  };

  return {
    matches: open.slice(0, limit),
    leagues,
    overview,
    attribution: ODDS_ATTRIBUTION,
    fetchedAt,
    cached,
  };
}

export function getCachedMatch(id: string): MatchOdds | null {
  return g.__jiyOddsCache?.matches.find((m) => m.id === id) || null;
}

/** Normalize team name for fuzzy result matching. */
export function normTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose match — UI only. Never use for settlement. */
export function teamsLikelyMatch(a: string, b: string): boolean {
  const na = normTeam(a);
  const nb = normTeam(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 2));
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit >= 1 && hit / Math.max(ta.size, 1) >= 0.5;
}

/** Settlement-safe: exact after stripping common club suffixes (fc/cf/fk…). */
export function teamsStrictMatch(a: string, b: string): boolean {
  const strip = (name: string) =>
    normTeam(name)
      .replace(/\b(fc|cf|fk|sc|ac|afc|club)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = strip(a);
  const nb = strip(b);
  return Boolean(na && nb && na.length >= 3 && na === nb);
}
