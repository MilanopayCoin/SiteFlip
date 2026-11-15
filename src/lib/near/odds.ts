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
  /** Decimal fair odds 1X2 */
  odds: { home: number; draw: number; away: number };
  probabilities: { home: number; draw: number; away: number };
  status: string;
  url: string;
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

const CACHE_MS = 60_000;

function houseOdds(fair: number): number {
  // Slight house edge vs fair (~4%).
  const o = fair * 0.96;
  return Math.max(1.01, Math.round(o * 100) / 100);
}

export async function fetchMatchOdds(limit = 40): Promise<{
  matches: MatchOdds[];
  attribution: typeof ODDS_ATTRIBUTION;
  fetchedAt: string;
  cached: boolean;
}> {
  const now = Date.now();
  if (g.__jiyOddsCache && now - g.__jiyOddsCache.at < CACHE_MS) {
    return {
      matches: g.__jiyOddsCache.matches.slice(0, limit),
      attribution: ODDS_ATTRIBUTION,
      fetchedAt: new Date(g.__jiyOddsCache.at).toISOString(),
      cached: true,
    };
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
    if (!p.fair_odds?.home || !p.fair_odds.draw || !p.fair_odds.away) continue;
    matches.push({
      id: `ta-${p.id}`,
      source: "tipsaudit",
      league: p.league || "Football",
      home: p.home,
      away: p.away,
      kickoffUtc: p.kickoff_utc,
      odds: {
        home: houseOdds(p.fair_odds.home),
        draw: houseOdds(p.fair_odds.draw),
        away: houseOdds(p.fair_odds.away),
      },
      probabilities: {
        home: p.fair_probabilities?.home ?? 0,
        draw: p.fair_probabilities?.draw ?? 0,
        away: p.fair_probabilities?.away ?? 0,
      },
      status: p.status || "none",
      url: p.url || ODDS_ATTRIBUTION.url,
    });
  }
  matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  g.__jiyOddsCache = { at: now, matches };
  return {
    matches: matches.slice(0, limit),
    attribution: ODDS_ATTRIBUTION,
    fetchedAt: new Date(now).toISOString(),
    cached: false,
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
