"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";
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
import type { MatchOdds } from "@/lib/near/odds";
import {
  shortAddress,
  STARKEY_INSTALL_URL,
  useStarkeyEvm,
} from "@/lib/starkey";

const PICK_LABEL = { home: "1", draw: "X", away: "2" } as const;

export function MatchBetsApp() {
  const starkey = useStarkeyEvm();
  const wallet = starkey.account;
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchOdds[]>([]);
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [balances, setBalances] = useState<MatchBalances | null>(null);
  const [attribution, setAttribution] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [treasuryMove, setTreasuryMove] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"jiy" | "supra">("supra");
  const [stake, setStake] = useState("10");
  const [leagueFilter, setLeagueFilter] = useState("");

  useEffect(() => {
    setSessionReady(Boolean(getNearToken()));
  }, []);

  const refresh = useCallback(async (settle = false) => {
    const q = settle ? "?settle=1&limit=50" : "?limit=50";
    const data = await nearFetch(`/api/near/bets${q}`);
    setMatches(data.matches || []);
    setAttribution(data.attribution || null);
    if (data.balances) setBalances(data.balances);
    if (data.bets) setBets(data.bets);
    setTreasuryMove(data.treasuryMove || null);
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      void nearFetch("/api/near/bets?limit=30")
        .then((data) => {
          setMatches(data.matches || []);
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
    }, 90_000);
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

  async function place(match: MatchOdds, pick: "home" | "draw" | "away") {
    if (!sessionReady || !wallet) {
      setError("Önce StarKey ile giriş yap");
      return;
    }
    const amount = Number(stake);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Geçerli stake gir");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await placeMatchBetOnChain({
        matchId: match.id,
        pick,
        stake: amount,
        currency,
        treasuryMove,
      });
      setBalances(data.balances as MatchBalances);
      setFlash(
        `${PICK_LABEL[pick]} · ${match.home} vs ${match.away} · ${amount} ${currency.toUpperCase()} (${data.network})`
      );
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
      setFlash(n ? `${n} bahis sonuçlandı` : "Henüz sonuçlanan maç yok");
      window.setTimeout(() => setFlash(null), 2800);
      await refresh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = leagueFilter.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.league.toLowerCase().includes(q) ||
        m.home.toLowerCase().includes(q) ||
        m.away.toLowerCase().includes(q)
    );
  }, [matches, leagueFilter]);

  return (
    <div className="min-h-[100dvh] bg-[#070708] text-[#f2f2f0]">
      <header className="sticky top-0 z-10 border-b border-white/8 bg-[#070708]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/near"
              className="text-[#a1a1aa] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p
                className="text-sm font-semibold text-[#d4ff3a]"
                style={{ fontFamily: "var(--font-near-display), sans-serif" }}
              >
                JIY Bahis
              </p>
              <p className="text-[11px] text-[#71717a]">
                Maç oranlı · SUPRA + JIY
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !sessionReady}
              onClick={() => void settleNow()}
            >
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
              Sonuç
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-24">
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {flash ? (
          <p className="rounded-lg border border-[#d4ff3a]/30 bg-[#d4ff3a]/10 px-3 py-2 text-sm text-[#d4ff3a]">
            {flash}
          </p>
        ) : null}

        {!sessionReady ? (
          <section className="rounded-2xl border border-white/10 bg-[#121214] p-5">
            <p
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-near-display), sans-serif" }}
            >
              StarKey ile oyna
            </p>
            <p className="mt-2 text-sm text-[#9ca3af]">
              Ücretsiz TipsAudit fair odds · 1X2. SUPRA ledger chip veya JIY
              (Move mainnet treasury varsa zincir).
            </p>
            {starkey.status === "missing" ? (
              <a
                href={STARKEY_INSTALL_URL}
                className="mt-4 inline-flex text-sm text-[#d4ff3a] underline"
                target="_blank"
                rel="noreferrer"
              >
                StarKey yükle
              </a>
            ) : (
              <Button
                className="mt-4"
                disabled={busy || starkey.status === "connecting"}
                onClick={() => void connect()}
              >
                StarKey bağla
              </Button>
            )}
          </section>
        ) : (
          <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#121214] p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#71717a]">
                Cüzdan
              </p>
              <p className="mt-1 font-mono text-sm">
                {wallet ? shortAddress(wallet) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#71717a]">
                SUPRA
              </p>
              <p className="mt-1 text-lg font-semibold text-[#38bdf8]">
                {balances?.supra?.toLocaleString("tr-TR") ?? "…"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#71717a]">
                JIY
              </p>
              <p className="mt-1 text-lg font-semibold text-[#d4ff3a]">
                {balances?.jiy?.toLocaleString("tr-TR") ?? "…"}
              </p>
            </div>
          </section>
        )}

        <section className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-[#71717a]">
              Para birimi
            </label>
            <div className="flex gap-1.5">
              {(["supra", "jiy"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase ${
                    currency === c
                      ? c === "jiy"
                        ? "bg-[#d4ff3a] text-[#0a0a0b]"
                        : "bg-[#38bdf8] text-[#0a0a0b]"
                      : "border border-white/15 text-[#a1a1aa]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-[#71717a]">
              Stake
            </label>
            <Input
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="h-9 w-28 bg-[#0c0c0e]"
              inputMode="decimal"
            />
          </div>
          <div className="min-w-[10rem] flex-1 space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-[#71717a]">
              Lig / takım
            </label>
            <Input
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              placeholder="Premier, Galatasaray…"
              className="h-9 bg-[#0c0c0e]"
            />
          </div>
        </section>

        {currency === "jiy" && treasuryMove ? (
          <p className="text-[11px] text-[#a1a1aa]">
            JIY bahisleri Move mainnet treasury’ye FA transfer ile gider.
          </p>
        ) : currency === "jiy" ? (
          <p className="text-[11px] text-[#a1a1aa]">
            Treasury yok — JIY ledger bakiyesinden oynanır (başlangıç +50).
          </p>
        ) : (
          <p className="text-[11px] text-[#a1a1aa]">
            SUPRA ledger chip (başlangıç 2.000) — demo ekonomi.
          </p>
        )}

        <ul className="space-y-3">
          {filtered.map((m) => {
            const kick = new Date(m.kickoffUtc);
            return (
              <li
                key={m.id}
                className="rounded-2xl border border-white/10 bg-[#0c0c0e] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#71717a]">
                      {m.league}
                    </p>
                    <p
                      className="mt-1 text-base font-semibold leading-snug"
                      style={{
                        fontFamily: "var(--font-near-display), sans-serif",
                      }}
                    >
                      {m.home}{" "}
                      <span className="text-[#71717a]">vs</span> {m.away}
                    </p>
                    <p className="mt-1 text-[11px] text-[#71717a]">
                      {kick.toLocaleString("tr-TR", {
                        timeZone: "Europe/Amsterdam",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      · Amsterdam
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["home", m.odds.home, m.home],
                      ["draw", m.odds.draw, "Beraberlik"],
                      ["away", m.odds.away, m.away],
                    ] as const
                  ).map(([pick, odd, label]) => (
                    <button
                      key={pick}
                      type="button"
                      disabled={busy || !sessionReady}
                      onClick={() => void place(m, pick)}
                      className="rounded-xl border border-white/12 bg-[#121214] px-2 py-2.5 text-center transition hover:border-[#d4ff3a]/40 disabled:opacity-50"
                    >
                      <span className="block text-[10px] text-[#71717a]">
                        {PICK_LABEL[pick]} · {label.slice(0, 14)}
                      </span>
                      <span className="mt-1 block font-mono text-sm font-semibold text-[#d4ff3a]">
                        {odd.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        {bets.length > 0 ? (
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71717a]">
              Bahislerim
            </p>
            <ul className="space-y-2">
              {bets.slice(0, 20).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {PICK_LABEL[b.pick]} · {b.home}–{b.away} · {b.stake}{" "}
                    {b.currency.toUpperCase()} @ {b.odds.toFixed(2)}
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-semibold uppercase ${
                      b.status === "won"
                        ? "text-[#d4ff3a]"
                        : b.status === "lost"
                          ? "text-red-300"
                          : "text-[#71717a]"
                    }`}
                  >
                    {b.status}
                    {b.status === "won" ? ` +${b.potentialWin}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {attribution ? (
          <p className="pb-4 text-center text-[11px] text-[#52525b]">
            Oran verisi:{" "}
            <a
              href={attribution.url}
              target="_blank"
              rel="noreferrer"
              className="text-[#a1a1aa] underline-offset-2 hover:underline"
            >
              {attribution.name}
            </a>{" "}
            · fair odds (−%4 house)
          </p>
        ) : null}
      </main>
    </div>
  );
}
