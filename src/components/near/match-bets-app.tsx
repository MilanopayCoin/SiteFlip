"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getNearToken,
  nearFetch,
  placeMatchBetOnChain,
  setNearToken,
  signInWithStarkey,
} from "@/lib/near/client";
import type { MatchBet, MatchBalances } from "@/lib/near/match-bets";
import type { LeagueStat, MarketOverview, MatchOdds } from "@/lib/near/odds";
import {
  shortAddress,
  STARKEY_INSTALL_URL,
  useStarkeyEvm,
} from "@/lib/starkey";

const PICK_LABEL = { home: "1", draw: "X", away: "2" } as const;
type Pick = keyof typeof PICK_LABEL;
type Tab = "markets" | "positions" | "history";
type BucketFilter = "all" | "starting_soon" | "today";

type SlipItem = {
  matchId: string;
  home: string;
  away: string;
  league: string;
  kickoffUtc: string;
  pick: Pick;
  odds: number;
  implied: number;
};

const STAKE_CHIPS = [10, 25, 50, 100, 250] as const;

function fmtKick(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCountdown(mins: number) {
  if (mins < 0) return "Başladı";
  if (mins < 60) return `${mins}dk`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}s ${mins % 60}dk`;
  return `${Math.floor(mins / (24 * 60))}g`;
}

function ProbBar({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  const h = Math.max(0, home) * 100;
  const d = Math.max(0, draw) * 100;
  const a = Math.max(0, away) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a1d]">
      <div className="bg-[#00d4aa]" style={{ width: `${h}%` }} />
      <div className="bg-[#6b7280]" style={{ width: `${d}%` }} />
      <div className="bg-[#f59e0b]" style={{ width: `${a}%` }} />
    </div>
  );
}

export function MatchBetsApp() {
  const starkey = useStarkeyEvm();
  const wallet = starkey.account;
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchOdds[]>([]);
  const [leagues, setLeagues] = useState<LeagueStat[]>([]);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [balances, setBalances] = useState<MatchBalances | null>(null);
  const [positions, setPositions] = useState<{
    open: number;
    openStake: number;
    openToWin: number;
    won: number;
    lost: number;
  } | null>(null);
  const [attribution, setAttribution] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [treasuryMove, setTreasuryMove] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"jiy" | "supra">("supra");
  const [stake, setStake] = useState("25");
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<string>("");
  const [bucket, setBucket] = useState<BucketFilter>("all");
  const [tab, setTab] = useState<Tab>("markets");
  const [slip, setSlip] = useState<SlipItem[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);

  useEffect(() => {
    setSessionReady(Boolean(getNearToken()));
  }, []);

  const refresh = useCallback(async (settle = false) => {
    const q = settle ? "?settle=1&limit=100" : "?limit=100";
    const data = await nearFetch(`/api/near/bets${q}`);
    setMatches(data.matches || []);
    setLeagues(data.leagues || []);
    setOverview(data.overview || null);
    setAttribution(data.attribution || null);
    if (data.balances) setBalances(data.balances);
    if (data.bets) setBets(data.bets);
    if (data.positions) setPositions(data.positions);
    setTreasuryMove(data.treasuryMove || null);
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      void nearFetch("/api/near/bets?limit=100")
        .then((data) => {
          setMatches(data.matches || []);
          setLeagues(data.leagues || []);
          setOverview(data.overview || null);
          setAttribution(data.attribution || null);
        })
        .catch(() => {});
      return;
    }
    void refresh(true).catch((e) =>
      setError(e instanceof Error ? e.message : "Yüklenemedi")
    );
    const id = window.setInterval(() => {
      void refresh(false).catch(() => {});
    }, 45_000);
    return () => window.clearInterval(id);
  }, [sessionReady, refresh]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      if (starkey.status === "missing" || starkey.status === "checking") {
        throw new Error("StarKey yok");
      }
      const addr = await starkey.connect();
      if (!addr) throw new Error("Bağlantı iptal");
      await signInWithStarkey(addr);
      setNearToken(getNearToken());
      setSessionReady(true);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  function addToSlip(match: MatchOdds, pick: Pick) {
    const item: SlipItem = {
      matchId: match.id,
      home: match.home,
      away: match.away,
      league: match.league,
      kickoffUtc: match.kickoffUtc,
      pick,
      odds: match.odds[pick],
      implied: match.implied[pick],
    };
    setSlip((prev) => {
      const without = prev.filter((s) => s.matchId !== match.id);
      return [...without, item];
    });
    setSlipOpen(true);
  }

  function removeFromSlip(matchId: string) {
    setSlip((prev) => prev.filter((s) => s.matchId !== matchId));
  }

  async function placeSlip() {
    if (!sessionReady || !wallet) {
      setError("Önce StarKey ile giriş yap");
      return;
    }
    if (!slip.length) return;
    const amount = Number(stake);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Geçerli stake gir");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let lastBalances: MatchBalances | null = null;
      for (const item of slip) {
        const data = await placeMatchBetOnChain({
          matchId: item.matchId,
          pick: item.pick,
          stake: amount,
          currency,
          treasuryMove,
        });
        lastBalances = data.balances as MatchBalances;
      }
      if (lastBalances) setBalances(lastBalances);
      setFlash(
        `Market · ${slip.length} pozisyon · ${amount} ${currency.toUpperCase()} / seçim`
      );
      setSlip([]);
      setSlipOpen(false);
      setTab("positions");
      window.setTimeout(() => setFlash(null), 3200);
      await refresh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bahis başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function settleNow() {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/bets", {
        method: "POST",
        body: JSON.stringify({ action: "settle" }),
      });
      if (data.balances) setBalances(data.balances);
      const n = (data.settled || []).length;
      setFlash(n ? `${n} pozisyon settle edildi` : "Henüz settle yok");
      window.setTimeout(() => setFlash(null), 2800);
      await refresh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (league && m.league !== league) return false;
      if (bucket !== "all" && m.bucket !== bucket) {
        if (!(bucket === "today" && m.bucket === "starting_soon")) return false;
      }
      if (!q) return true;
      return (
        m.league.toLowerCase().includes(q) ||
        m.home.toLowerCase().includes(q) ||
        m.away.toLowerCase().includes(q)
      );
    });
  }, [matches, league, bucket, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MatchOdds[]>();
    for (const m of filtered) {
      const list = map.get(m.league) || [];
      list.push(m);
      map.set(m.league, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const stakeNum = Number(stake) || 0;
  const slipToWin = slip.reduce((a, s) => a + stakeNum * s.odds, 0);
  const bal =
    currency === "supra" ? balances?.supra ?? 0 : balances?.jiy ?? 0;
  const openBets = bets.filter((b) => b.status === "open");
  const closedBets = bets.filter((b) => b.status !== "open");

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-[#f5f5f5]">
      <header className="sticky top-0 z-20 border-b border-[#1f1f1f] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/near"
              className="text-[#8b8b8b] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#00d4aa]">
                JIY Outcomes
              </p>
              <p className="text-sm font-semibold tracking-tight">
                Sports Markets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#2a2a2a] bg-transparent"
              disabled={busy || !sessionReady}
              onClick={() => void settleNow()}
            >
              <Trophy className="mr-1.5 h-3.5 w-3.5 text-[#00d4aa]" />
              Settle
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setSlipOpen(true)}
              className="relative rounded-lg border border-[#2a2a2a] px-3 py-1.5 text-xs font-semibold text-[#00d4aa]"
            >
              Slip
              {slip.length > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00d4aa] px-1 text-[10px] text-black">
                  {slip.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {overview ? (
          <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2 border-t border-[#141414] px-4 py-2 text-center">
            {[
              ["Events", overview.events],
              ["Leagues", overview.leagues],
              ["Soon", overview.startingSoon],
              ["Today", overview.today],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                  {label}
                </p>
                <p className="font-mono text-sm font-semibold text-white">
                  {val as number}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 pb-36">
        {error ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {flash ? (
          <p className="mb-3 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-2 text-sm text-[#00d4aa]">
            {flash}
          </p>
        ) : null}

        {!sessionReady ? (
          <section className="mb-4 rounded-xl border border-[#1f1f1f] bg-[#111113] p-5">
            <p className="text-lg font-semibold">Connect to trade outcomes</p>
            <p className="mt-2 text-sm text-[#9ca3af]">
              TipsAudit fair odds · market fill 1X2 · SUPRA ledger veya JIY Move
              treasury. OKX Outcomes tarzı pozisyon + betslip.
            </p>
            {starkey.status === "missing" ? (
              <a
                href={STARKEY_INSTALL_URL}
                className="mt-4 inline-flex text-sm text-[#00d4aa] underline"
                target="_blank"
                rel="noreferrer"
              >
                StarKey yükle
              </a>
            ) : (
              <Button
                className="mt-4 bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90"
                disabled={busy || starkey.status === "connecting"}
                onClick={() => void connect()}
              >
                StarKey bağla
              </Button>
            )}
          </section>
        ) : (
          <section className="mb-4 grid gap-2 rounded-xl border border-[#1f1f1f] bg-[#111113] p-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                Wallet
              </p>
              <p className="mt-0.5 font-mono text-sm">
                {wallet ? shortAddress(wallet) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                SUPRA
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-[#38bdf8]">
                {balances?.supra?.toLocaleString("tr-TR") ?? "…"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                JIY
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-[#00d4aa]">
                {balances?.jiy?.toLocaleString("tr-TR") ?? "…"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                Open to win
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold">
                {positions?.openToWin?.toLocaleString("tr-TR", {
                  maximumFractionDigits: 2,
                }) ?? "0"}
              </p>
            </div>
          </section>
        )}

        <div className="mb-4 flex gap-1 rounded-lg border border-[#1f1f1f] bg-[#0f0f10] p-1">
          {(
            [
              ["markets", "Markets"],
              ["positions", `Positions${positions ? ` (${positions.open})` : ""}`],
              ["history", "History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                tab === id
                  ? "bg-[#1a1a1d] text-[#00d4aa]"
                  : "text-[#8b8b8b] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "markets" ? (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="flex gap-1">
                {(
                  [
                    ["all", "All"],
                    ["starting_soon", "Soon"],
                    ["today", "Today"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBucket(id)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                      bucket === id
                        ? "bg-[#00d4aa] text-black"
                        : "border border-[#2a2a2a] text-[#9ca3af]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(["supra", "jiy"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase ${
                      currency === c
                        ? c === "jiy"
                          ? "bg-[#00d4aa] text-black"
                          : "bg-[#38bdf8] text-black"
                        : "border border-[#2a2a2a] text-[#9ca3af]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team / league"
                className="h-8 min-w-[10rem] flex-1 border-[#2a2a2a] bg-[#111113] text-sm"
              />
            </div>

            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setLeague("")}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                  !league
                    ? "bg-[#1f1f1f] text-white"
                    : "text-[#8b8b8b] hover:text-white"
                }`}
              >
                All leagues
              </button>
              {leagues.slice(0, 16).map((l) => (
                <button
                  key={l.name}
                  type="button"
                  onClick={() =>
                    setLeague((prev) => (prev === l.name ? "" : l.name))
                  }
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                    league === l.name
                      ? "bg-[#1f1f1f] text-[#00d4aa]"
                      : "text-[#8b8b8b] hover:text-white"
                  }`}
                >
                  {l.name} · {l.count}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {grouped.map(([leagueName, rows]) => (
                <section key={leagueName}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
                      {leagueName}
                    </p>
                    <span className="text-[10px] text-[#52525b]">
                      {rows.length} markets
                    </span>
                  </div>
                  <ul className="divide-y divide-[#161616] overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0f0f10]">
                    {rows.map((m) => {
                      const active = slip.find((s) => s.matchId === m.id);
                      return (
                        <li key={m.id} className="p-3 sm:p-3.5">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {m.home}{" "}
                                <span className="text-[#52525b]">vs</span>{" "}
                                {m.away}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#6b7280]">
                                {fmtKick(m.kickoffUtc)} · Amsterdam ·{" "}
                                <span className="text-[#00d4aa]">
                                  {fmtCountdown(m.minutesToKick)}
                                </span>
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#333]" />
                          </div>
                          <ProbBar
                            home={m.probabilities.home}
                            draw={m.probabilities.draw}
                            away={m.probabilities.away}
                          />
                          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ["home", m.odds.home, m.implied.home, m.home],
                                ["draw", m.odds.draw, m.implied.draw, "Draw"],
                                ["away", m.odds.away, m.implied.away, m.away],
                              ] as const
                            ).map(([pick, odd, imp, label]) => {
                              const selected = active?.pick === pick;
                              return (
                                <button
                                  key={pick}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => addToSlip(m, pick)}
                                  className={`rounded-lg border px-2 py-2 text-left transition ${
                                    selected
                                      ? "border-[#00d4aa] bg-[#00d4aa]/10"
                                      : "border-[#222] bg-[#141416] hover:border-[#00d4aa]/40"
                                  }`}
                                >
                                  <span className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-medium text-[#8b8b8b]">
                                      {PICK_LABEL[pick]}
                                    </span>
                                    <span className="text-[10px] text-[#52525b]">
                                      {(imp * 100).toFixed(0)}%
                                    </span>
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-[#6b7280]">
                                    {label}
                                  </span>
                                  <span className="mt-0.5 block font-mono text-sm font-semibold text-[#00d4aa]">
                                    {odd.toFixed(2)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!grouped.length ? (
                <p className="py-10 text-center text-sm text-[#6b7280]">
                  Bu filtrede market yok
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "positions" ? (
          <section className="space-y-2">
            <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-[#1f1f1f] bg-[#111113] p-3 text-center">
              <div>
                <p className="text-[10px] text-[#6b7280]">Open</p>
                <p className="font-mono font-semibold">{positions?.open ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#6b7280]">Stake</p>
                <p className="font-mono font-semibold">
                  {positions?.openStake?.toLocaleString("tr-TR") ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#6b7280]">To win</p>
                <p className="font-mono font-semibold text-[#00d4aa]">
                  {positions?.openToWin?.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  }) ?? 0}
                </p>
              </div>
            </div>
            {!sessionReady ? (
              <p className="text-sm text-[#6b7280]">Giriş gerekli</p>
            ) : openBets.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6b7280]">
                Açık pozisyon yok — Markets’tan slip’e ekle
              </p>
            ) : (
              <ul className="divide-y divide-[#161616] overflow-hidden rounded-xl border border-[#1f1f1f]">
                {openBets.map((b) => (
                  <li key={b.id} className="bg-[#0f0f10] px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {PICK_LABEL[b.pick]} · {b.home} vs {b.away}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#6b7280]">
                          {b.league} · @{b.odds.toFixed(2)} · {b.stake}{" "}
                          {b.currency.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-[#6b7280]">
                          To win
                        </p>
                        <p className="font-mono text-sm font-semibold text-[#00d4aa]">
                          {b.potentialWin}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "history" ? (
          <section>
            {!sessionReady ? (
              <p className="text-sm text-[#6b7280]">Giriş gerekli</p>
            ) : closedBets.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6b7280]">
                Settle edilmiş pozisyon yok
              </p>
            ) : (
              <ul className="divide-y divide-[#161616] overflow-hidden rounded-xl border border-[#1f1f1f]">
                {closedBets.slice(0, 40).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 bg-[#0f0f10] px-3 py-2.5 text-sm"
                  >
                    <span className="truncate">
                      {PICK_LABEL[b.pick]} · {b.home}–{b.away}
                      {b.scoreHome != null
                        ? ` · ${b.scoreHome}-${b.scoreAway}`
                        : ""}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-bold uppercase ${
                        b.status === "won"
                          ? "text-[#00d4aa]"
                          : b.status === "lost"
                            ? "text-red-400"
                            : "text-[#6b7280]"
                      }`}
                    >
                      {b.status}
                      {b.status === "won" ? ` +${b.potentialWin}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {attribution ? (
          <p className="mt-8 pb-2 text-center text-[11px] text-[#3f3f46]">
            Settlement rules: InferSports final 1X2 · Odds{" "}
            <a
              href={attribution.url}
              target="_blank"
              rel="noreferrer"
              className="text-[#6b7280] underline-offset-2 hover:underline"
            >
              {attribution.name}
            </a>{" "}
            fair −4% house · Market order fill
          </p>
        ) : null}
      </main>

      {/* Betslip drawer — OKX Outcomes style */}
      {slipOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <button
            type="button"
            className="flex-1"
            aria-label="Close slip"
            onClick={() => setSlipOpen(false)}
          />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-[#1f1f1f] bg-[#0c0c0d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#00d4aa]">
                  Betslip
                </p>
                <p className="text-sm font-semibold">
                  Market order · {slip.length} selection
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSlipOpen(false)}
                className="rounded-md p-1 text-[#8b8b8b] hover:bg-[#1a1a1d]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {!slip.length ? (
                <p className="py-10 text-center text-sm text-[#6b7280]">
                  Markets’tan 1 / X / 2 seç
                </p>
              ) : (
                slip.map((s) => (
                  <div
                    key={s.matchId}
                    className="rounded-lg border border-[#1f1f1f] bg-[#111113] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-[#6b7280]">{s.league}</p>
                        <p className="truncate text-sm font-medium">
                          {s.home} vs {s.away}
                        </p>
                        <p className="mt-1 text-xs text-[#9ca3af]">
                          {PICK_LABEL[s.pick]} · {(s.implied * 100).toFixed(0)}%
                          implied
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#00d4aa]">
                          {s.odds.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromSlip(s.matchId)}
                          className="text-[#6b7280] hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 border-t border-[#1f1f1f] px-4 py-4">
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[#6b7280]">
                  Stake / selection ({currency.toUpperCase()})
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {STAKE_CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStake(String(n))}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        stake === String(n)
                          ? "bg-[#00d4aa] text-black"
                          : "border border-[#2a2a2a] text-[#9ca3af]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setStake(
                        String(
                          Math.max(
                            1,
                            Math.floor(bal / Math.max(slip.length, 1))
                          )
                        )
                      )
                    }
                    className="rounded-md border border-[#2a2a2a] px-2.5 py-1 text-[11px] font-semibold text-[#9ca3af]"
                  >
                    MAX
                  </button>
                </div>
                <Input
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  inputMode="decimal"
                  className="h-10 border-[#2a2a2a] bg-[#111113] font-mono"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Est. return</span>
                <span className="font-mono font-semibold text-[#00d4aa]">
                  {slipToWin.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {currency.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[#6b7280]">
                <span>Total stake</span>
                <span className="font-mono">
                  {(stakeNum * slip.length).toLocaleString("tr-TR")}{" "}
                  {currency.toUpperCase()}
                </span>
              </div>
              <Button
                className="w-full bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90"
                disabled={busy || !slip.length || !sessionReady}
                onClick={() => void placeSlip()}
              >
                {busy ? "Filling…" : "Place market order"}
              </Button>
              <p className="text-center text-[10px] text-[#3f3f46]">
                Instant fill @ quoted odds · auto-settle after kickoff+85m
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
