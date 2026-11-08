"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ForgeMeter } from "@/components/games/chrono-forge/forge-meter";
import { ReelGrid } from "@/components/games/chrono-forge/reel-grid";
import {
  forgeTierFromMeter,
  instantBronzeForge,
  meterGainFromSpin,
  resolveForgePick,
  resolveGrandForge,
  scatterFreeSpins,
  spin,
} from "@/lib/games/chrono-forge/engine";
import { DEMO_RTP_NOTE, PAYABLE, SYMBOLS } from "@/lib/games/chrono-forge/symbols";
import type {
  FurnaceChoice,
  GamePhase,
  Grid,
  SymbolId,
} from "@/lib/games/chrono-forge/types";
import { REEL_COUNT, ROW_COUNT } from "@/lib/games/chrono-forge/types";
import { cn } from "@/lib/utils";

const INITIAL_BALANCE = 5000;

function emptyGrid(): Grid {
  const ids: SymbolId[] = ["gear", "hammer", "coal", "clock"];
  return Array.from({ length: REEL_COUNT }, (_, c) =>
    Array.from({ length: ROW_COUNT }, (_, r) => ids[(c + r) % ids.length]!)
  );
}

export function ChronoForgeGame() {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [spinning, setSpinning] = useState(false);
  const [forgeMeter, setForgeMeter] = useState(0);
  const [artifacts, setArtifacts] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("base");
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [freeSpinMult, setFreeSpinMult] = useState(1);
  const [stormTick, setStormTick] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [fusion, setFusion] = useState(false);
  const [timeShift, setTimeShift] = useState(false);
  const [log, setLog] = useState<string[]>([
    "Zaman Demircisi'ne hoş geldin. Forge metreyi doldur veya 3 Portal ile Zaman Çöküşü'nü aç.",
  ]);
  const [winSymbols, setWinSymbols] = useState<SymbolId[]>([]);

  const inFreeSpins = freeSpinsLeft > 0 || phase === "free_spins";

  const pushLog = useCallback((msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 6));
  }, []);

  const applyMeter = useCallback(
    (gain: number) => {
      setForgeMeter((m) => {
        const next = Math.min(100, m + gain);
        const tier = forgeTierFromMeter(next);
        const prevTier = forgeTierFromMeter(m);
        if (tier === "bronze" && prevTier === "none") {
          pushLog("Bronz Forge kıvılcımı — küçük anlık ödül!");
          setBalance((b) => b + instantBronzeForge(bet));
        }
        if (next >= 100 && m < 100) {
          pushLog("Forge metrem doldu — fırın seçimi açılıyor!");
          setPhase("forge_pick");
        }
        return next;
      });
    },
    [bet, pushLog]
  );

  const runSpin = useCallback(async () => {
    if (spinning) return;
    if (phase === "forge_pick" || phase === "grand_forge") return;

    const isFree = freeSpinsLeft > 0;
    if (!isFree && balance < bet) {
      pushLog("Yetersiz demo bakiye.");
      return;
    }

    setSpinning(true);
    setLastWin(0);
    setWinSymbols([]);
    setTimeShift(false);
    setFusion(false);

    if (!isFree) {
      setBalance((b) => b - bet);
    }

    await new Promise((r) => setTimeout(r, 650));

    const stormSoon = isFree && stormTick === 2;
    const result = spin({
      bet,
      inFreeSpins: isFree,
      winMultiplier: freeSpinMult,
      forceTimeShift: stormSoon ? true : undefined,
    });

    setGrid(result.grid);
    setTimeShift(result.timeShift);
    setFusion(result.fusion);

    if (result.totalWin > 0) {
      setBalance((b) => b + result.totalWin);
      setLastWin(result.totalWin);
      setWinSymbols(result.wins.map((w) => w.symbol));
      pushLog(
        `Kazanç: ${result.totalWin.toFixed(0)} demo · ${result.wins.length} kombinasyon`
      );
    }

    applyMeter(
      meterGainFromSpin(result.wildCount, result.ironCount, isFree)
    );

    if (result.artifactFound) {
      setArtifacts((a) => {
        const next = Math.min(3, a + 1);
        pushLog(`Artifact parçası (${next}/3)`);
        if (next >= 3) {
          pushLog("Grand Forge — pick & win!");
          setPhase("grand_forge");
          return 0;
        }
        return next;
      });
    }

    const fsAward = scatterFreeSpins(result.scatterCount);
    if (fsAward > 0 && !isFree) {
      setFreeSpinsLeft(fsAward);
      setPhase("free_spins");
      setFreeSpinMult(1);
      setStormTick(0);
      pushLog(`Zaman Çöküşü: ${fsAward} free spin!`);
    }

    if (isFree) {
      setFreeSpinsLeft((n) => {
        const left = n - 1;
        if (left <= 0) {
          setPhase("base");
          pushLog("Free spin turu bitti.");
        }
        return left;
      });
      setStormTick((t) => {
        const next = (t + 1) % 3;
        if (next === 0 && stormSoon) {
          setFreeSpinMult((m) => m + 1);
          pushLog(`Zaman Fırtınası! Çarpan ×${freeSpinMult + 1}`);
        }
        return next;
      });
    }

    setSpinning(false);
  }, [
    applyMeter,
    balance,
    bet,
    freeSpinMult,
    freeSpinsLeft,
    phase,
    pushLog,
    spinning,
    stormTick,
  ]);

  const onForgePick = (choice: FurnaceChoice) => {
    const { payout, message } = resolveForgePick(choice, bet);
    setBalance((b) => b + payout);
    setLastWin(payout);
    pushLog(message);
    setForgeMeter(0);
    setPhase(freeSpinsLeft > 0 ? "free_spins" : "base");
  };

  const onGrandForge = () => {
    const { payout, jackpot } = resolveGrandForge(bet);
    setBalance((b) => b + payout);
    setLastWin(payout);
    pushLog(
      jackpot
        ? `GRAND JACKPOT (demo)! ${payout.toFixed(0)}`
        : `Grand Forge ödülü: ${payout.toFixed(0)}`
    );
    setPhase(freeSpinsLeft > 0 ? "free_spins" : "base");
  };

  const stormLabel = useMemo(() => {
    if (!inFreeSpins) return null;
    const steps = ["1/3", "2/3", "Fırtına"];
    return steps[stormTick] ?? "1/3";
  }, [inFreeSpins, stormTick]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0806] to-background">
      <div className="border-b border-amber-900/30 bg-black/40 px-4 py-3">
        <div className="jiy-container flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-amber-400/90 hover:text-amber-300"
          >
            ← JIY.APP
          </Link>
          <span className="text-xs text-muted">Demo · gerçek para yok</span>
        </div>
      </div>
      <div className="jiy-container max-w-4xl space-y-6 py-8 sm:py-10">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          JIY.APP · Oyun konsept demosu
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Chrono Forge
          <span className="block text-lg font-normal text-muted sm:inline sm:pl-2 sm:text-xl">
            Zamanın Demircisi
          </span>
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          5×4 · Zaman katmanları · Forge metrem · Amusnet esintili demo (gerçek
          para yok). {DEMO_RTP_NOTE}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <ReelGrid
            grid={grid}
            spinning={spinning}
            fusion={fusion}
            timeShift={timeShift}
            highlightSymbols={winSymbols}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="min-w-[140px] bg-amber-500 text-black hover:bg-amber-400"
              onClick={() => void runSpin()}
              disabled={spinning || phase === "forge_pick" || phase === "grand_forge"}
            >
              {spinning
                ? "Dövülüyor…"
                : inFreeSpins
                  ? `Free Spin (${freeSpinsLeft})`
                  : "SPIN"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Bahis</span>
              {[5, 10, 25, 50].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBet(b)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors",
                    bet === b
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-surface text-muted hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="border-amber-900/30 bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Demirci paneli</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Bakiye</span>
                <span className="font-mono font-semibold">{balance.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Son kazanç</span>
                <span className="font-mono text-accent">{lastWin.toFixed(0)}</span>
              </div>
              <ForgeMeter value={forgeMeter} />
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
                <span className="text-muted">Artifact</span>
                <span className="text-lg tracking-widest">
                  {"◆".repeat(artifacts)}
                  {"◇".repeat(3 - artifacts)}
                </span>
              </div>
              {inFreeSpins && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-950/30 px-3 py-2">
                  <p className="text-xs uppercase text-violet-300">Zaman Çöküşü</p>
                  <p className="font-medium">
                    Çarpan ×{freeSpinMult} · Fırtına {stormLabel}
                  </p>
                </div>
              )}
              <ul className="space-y-1 border-t border-border pt-3 text-xs text-muted">
                {log.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AnimatePresence>
        {phase === "forge_pick" && (
          <ForgePickOverlay onPick={onForgePick} />
        )}
        {phase === "grand_forge" && (
          <GrandForgeOverlay onClaim={onGrandForge} />
        )}
      </AnimatePresence>

      <Accordion type="single" collapsible className="rounded-xl border border-border bg-surface px-4">
        <AccordionItem value="gdd">
          <AccordionTrigger>GDD özeti & paytable (demo)</AccordionTrigger>
          <AccordionContent className="space-y-4 text-sm text-muted">
            <section>
              <h3 className="mb-2 font-semibold text-foreground">Zaman katmanları</h3>
              <ul className="list-inside list-disc space-y-1">
                <li>Sol 2 makara — Geçmiş: düşük ödeme, yüksek Forge / Demir</li>
                <li>Orta — Şimdi: dengeli semboller</li>
                <li>Sağ 2 makara — Gelecek: yüksek semboller, wild eğilimi</li>
                <li>Zaman Kayması: katmanlar yer değiştirir; nadir Fusion → 243 yol hissi</li>
              </ul>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-foreground">Sembol ödemeleri (× bahis / yol)</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2">Sembol</th>
                      <th className="py-2 pr-2">3</th>
                      <th className="py-2 pr-2">4</th>
                      <th className="py-2">5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYABLE.map((id) => (
                      <tr key={id} className="border-b border-border/50">
                        <td className="py-1.5 pr-2">
                          {SYMBOLS[id].emoji} {SYMBOLS[id].label}
                        </td>
                        <td>{SYMBOLS[id].pays[3]}</td>
                        <td>{SYMBOLS[id].pays[4]}</td>
                        <td>{SYMBOLS[id].pays[5]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-foreground">Feature matrisi</h3>
              <p>
                Forge metrem (Wild +8, Demir +5) · Bronz anlık ödül · Altın = 3 fırın seçimi ·
                3+ Portal = 10–20 FS · her 3. FS fırtına · 3 artifact = Grand Forge (demo jackpot
                %2).
              </p>
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      </div>
    </div>
  );
}

function ForgePickOverlay({ onPick }: { onPick: (c: FurnaceChoice) => void }) {
  const choices: { id: FurnaceChoice; title: string; desc: string }[] = [
    {
      id: "past",
      title: "Geçmiş fırını",
      desc: "Sticky wild + düşük–orta çarpan",
    },
    {
      id: "present",
      title: "Şimdi fırını",
      desc: "Expanding wild + re-spin hissi",
    },
    {
      id: "future",
      title: "Gelecek fırını",
      desc: "Cascade çarpanı x15–x150 (demo)",
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <motion.div
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-amber-600/40 bg-surface p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold text-amber-300">Forge Bonus — fırın seç</h2>
        <p className="mt-1 text-sm text-muted">Amusnet tarzı oyuncu kontrolü (demo).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className="rounded-xl border border-border bg-surface-2 p-4 text-left transition hover:border-amber-500/60 hover:bg-amber-950/30"
            >
              <p className="font-semibold text-foreground">{c.title}</p>
              <p className="mt-1 text-xs text-muted">{c.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function GrandForgeOverlay({ onClaim }: { onClaim: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <motion.div
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-violet-500/40 bg-surface p-6 text-center shadow-2xl"
      >
        <h2 className="text-xl font-bold text-violet-300">Grand Forge</h2>
        <p className="mt-2 text-sm text-muted">
          Üç artifact birleşti. Efsanevi örs seni bekliyor — demo pick & win.
        </p>
        <Button className="mt-6 w-full" onClick={onClaim}>
          Örsü kır — ödülü al
        </Button>
      </motion.div>
    </motion.div>
  );
}
