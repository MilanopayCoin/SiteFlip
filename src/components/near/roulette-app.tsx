"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  RotateCcw,
  Spade,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RouletteBoard,
  RouletteHistory,
} from "@/components/near/roulette-board";
import { RouletteSeatVideo } from "@/components/near/roulette-seat-video";
import {
  getNearToken,
  nearFetch,
  setNearToken,
  signInWithStarkey,
} from "@/lib/near/client";
import type {
  RouletteBetKind,
  RoulettePublic,
} from "@/lib/near/roulette";
import {
  shortAddress,
  STARKEY_INSTALL_URL,
  useStarkeyEvm,
} from "@/lib/starkey";

const RouletteWheel3D = dynamic(
  () =>
    import("@/components/near/roulette-wheel-3d").then((m) => m.RouletteWheel3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-[#c9a227]/70">
        European wheel yükleniyor…
      </div>
    ),
  }
);

export function RouletteApp({ initialTableId }: { initialTableId?: string }) {
  const starkey = useStarkeyEvm();
  const wallet = starkey.account;
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [table, setTable] = useState<RoulettePublic | null>(null);
  const [tables, setTables] = useState<RoulettePublic[]>([]);
  const [name, setName] = useState("Oyuncu");
  const [emoji, setEmoji] = useState("🎰");
  const [chip, setChip] = useState(50);
  const [camOn, setCamOn] = useState(false);
  const [joinId, setJoinId] = useState(initialTableId || "");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSessionReady(Boolean(getNearToken()));
  }, []);

  const refreshList = useCallback(async () => {
    const data = await nearFetch("/api/near/roulette");
    setTables(data.tables || []);
  }, []);

  const refreshTable = useCallback(async (id: string) => {
    const data = await nearFetch(
      `/api/near/roulette?tableId=${encodeURIComponent(id)}`
    );
    setTable(data.table);
  }, []);

  useEffect(() => {
    if (!sessionReady || !wallet) return;
    void refreshList().catch(() => undefined);
  }, [sessionReady, wallet, refreshList]);

  useEffect(() => {
    if (!table?.id || !sessionReady) return;
    const id = window.setInterval(() => {
      void refreshTable(table.id).catch(() => undefined);
      setTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [table?.id, sessionReady, refreshTable]);

  useEffect(() => {
    if (initialTableId && sessionReady && wallet && !table) {
      void (async () => {
        try {
          const data = await nearFetch("/api/near/roulette", {
            method: "POST",
            body: JSON.stringify({
              action: "join",
              tableId: initialTableId,
              displayName: name,
              avatarEmoji: emoji,
            }),
          });
          setTable(data.table);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Join failed");
        }
      })();
    }
  }, [initialTableId, sessionReady, wallet, table, name, emoji]);

  const secondsLeft = useMemo(() => {
    void tick;
    if (!table?.phaseEndsAt) return null;
    return Math.max(
      0,
      Math.ceil((new Date(table.phaseEndsAt).getTime() - Date.now()) / 1000)
    );
  }, [table?.phaseEndsAt, tick]);

  const myBal = useMemo(() => {
    if (!table || !wallet) return 0;
    return table.balances[wallet.toLowerCase()] ?? 0;
  }, [table, wallet]);

  const myBets = useMemo(() => {
    if (!table || !wallet) return [];
    return table.bets.filter((b) => b.wallet === wallet.toLowerCase());
  }, [table, wallet]);

  const isHost =
    !!table && !!wallet && table.hostWallet === wallet.toLowerCase();

  const myNet = useMemo(() => {
    if (!table || !wallet) return null;
    return (
      table.lastRoundNets?.find((n) => n.wallet === wallet.toLowerCase()) ||
      null
    );
  }, [table, wallet]);

  const phaseTitle =
    table?.phase === "lobby"
      ? "Lobi"
      : table?.phase === "betting"
        ? "Bahisler açık"
        : table?.phase === "spinning"
          ? "No more bets"
          : table?.phase === "result"
            ? "Sonuç"
            : "";

  async function toggleAuto() {
    if (!table) return;
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "auto",
          tableId: table.id,
          autoStart: !table.autoStart,
        }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto ayarı başarısız");
    }
  }

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      let addr = wallet;
      if (!addr) addr = await starkey.connect();
      if (!addr) throw new Error("StarKey iptal");
      await signInWithStarkey(addr);
      setSessionReady(true);
      setName((n) => (n === "Oyuncu" ? shortAddress(addr!) : n));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function createTable() {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          displayName: name,
          avatarEmoji: emoji,
          label: "European Roulette",
        }),
      });
      setTable(data.table);
      setFlash("Masa açıldı · 5.000 demo chip");
      window.setTimeout(() => setFlash(null), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Masa açılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function joinTable(id: string, seatIndex?: number) {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          tableId: id,
          displayName: name,
          avatarEmoji: emoji,
          seatIndex,
        }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Katılım başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!table) return;
    setBusy(true);
    try {
      await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({ action: "leave", tableId: table.id }),
      });
      setTable(null);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ayrılma başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function startRound() {
    if (!table) return;
    setBusy(true);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({ action: "start", tableId: table.id }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tur başlatılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function place(
    input: { kind: RouletteBetKind; numbers?: number[]; meta?: number }
  ) {
    if (!table) return;
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "bet",
          tableId: table.id,
          betKind: input.kind,
          numbers: input.numbers,
          meta: input.meta,
          amount: chip,
        }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bahis başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!table) return;
    setBusy(true);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({ action: "undo", tableId: table.id }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!table) return;
    setBusy(true);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({ action: "clear", tableId: table.id }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCam() {
    if (!table || !wallet) return;
    const next = !camOn;
    setCamOn(next);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "cam",
          tableId: table.id,
          camOn: next,
        }),
      });
      setTable(data.table);
    } catch {
      setCamOn(!next);
    }
  }

  const inviteUrl =
    typeof window !== "undefined" && table
      ? `${window.location.origin}/near/rulet/${table.id}`
      : "";

  return (
    <div className="min-h-[100dvh] bg-[#06140f] text-[#f3efe6]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(201,162,39,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(185,28,28,0.1), transparent 45%), linear-gradient(180deg,#06140f,#0a1f16 40%,#06140f)",
        }}
      />

      <header className="relative z-10 border-b border-[#c9a227]/25 bg-black/30 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/near"
              className="shrink-0 rounded-full border border-[#c9a227]/30 p-2 text-[#c9a227]/80 hover:text-[#ffe566]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#c9a227] sm:text-[10px] sm:tracking-[0.22em]">
                JIY Near Casino
              </p>
              <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
                European Roulette
              </p>
            </div>
          </div>
          {sessionReady && wallet ? (
            <button
              type="button"
              className="font-mono text-[11px] text-white/45"
              onClick={() => {
                setNearToken(null);
                setSessionReady(false);
                setTable(null);
                starkey.disconnect();
              }}
            >
              {shortAddress(wallet)}
            </button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-5">
        {error ? (
          <p className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {flash ? (
          <p className="mb-3 rounded-lg border border-[#c9a227]/40 bg-[#c9a227]/10 px-3 py-2 text-sm text-[#ffe566]">
            {flash}
          </p>
        ) : null}

        {!sessionReady || !wallet ? (
          <section className="mx-auto max-w-lg space-y-4 rounded-2xl border border-[#c9a227]/25 bg-black/30 p-6">
            <p className="text-sm leading-relaxed text-white/65">
              Profesyonel Avrupa ruleti: tam bahis tahtası (düz, split, street,
              dozen, kolon, kırmızı/siyah…), 3D çark, görüntülü koltuklar,
              commit–reveal adil spin. İlk sürüm{" "}
              <span className="text-[#ffe566]">5.000 demo chip</span> ile.
            </p>
            {starkey.status === "missing" ? (
              <Button asChild className="w-full bg-[#c9a227] text-[#1a1408]">
                <a href={STARKEY_INSTALL_URL} target="_blank" rel="noreferrer">
                  StarKey indir
                </a>
              </Button>
            ) : (
              <Button
                className="w-full bg-[#c9a227] text-[#1a1408] hover:bg-[#ffe566]"
                disabled={busy}
                onClick={() => void handleSignIn()}
              >
                StarKey ile masaya otur
              </Button>
            )}
          </section>
        ) : !table ? (
          <section className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="İsim"
                className="max-w-[180px] border-[#c9a227]/30 bg-black/40"
              />
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="w-16 border-[#c9a227]/30 bg-black/40"
              />
            </div>
            <Button
              disabled={busy}
              className="bg-[#c9a227] text-[#1a1408] hover:bg-[#ffe566]"
              onClick={() => void createTable()}
            >
              <Spade className="mr-2 h-4 w-4" />
              European masa aç
            </Button>
            <div className="flex gap-2">
              <Input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.trim())}
                placeholder="Masa kodu"
                className="border-[#c9a227]/30 bg-black/40 font-mono text-sm"
              />
              <Button
                variant="outline"
                disabled={busy || !joinId}
                className="border-[#c9a227]/40"
                onClick={() => void joinTable(joinId)}
              >
                Katıl
              </Button>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-white/45">
                <Users className="h-3.5 w-3.5" /> Canlı masalar
              </p>
              <ul className="space-y-2">
                {tables.length === 0 ? (
                  <li className="text-sm text-white/35">Henüz masa yok</li>
                ) : (
                  tables.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-[#c9a227]/20 px-3 py-3 text-left hover:border-[#c9a227]/55"
                        onClick={() => void joinTable(t.id)}
                      >
                        <span>
                          {t.label}{" "}
                          <span className="font-mono text-[10px] text-white/35">
                            {t.id}
                          </span>
                        </span>
                        <span className="text-xs text-white/45">
                          {t.seats.filter(Boolean).length}/8 · {t.phase}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            {/* Status bar */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#c9a227]/25 bg-black/35 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#c9a227]">
                  {phaseTitle}
                  {secondsLeft != null ? ` · ${secondsLeft}s` : ""}
                </p>
                <p className="truncate font-mono text-[10px] text-white/45 sm:text-xs">
                  #{table.round}
                  {table.commitHash
                    ? ` · ${table.commitHash.slice(0, 8)}…`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-[#c9a227]/40 px-2.5 py-1 text-xs font-semibold text-[#ffe566] sm:text-sm">
                  {myBal.toLocaleString("tr-TR")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#c9a227]/35 px-2"
                  onClick={() => void toggleCam()}
                >
                  {camOn ? (
                    <CameraOff className="h-3.5 w-3.5" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#c9a227]/35 px-2 text-[11px]"
                  onClick={() => void leave()}
                >
                  Ayrıl
                </Button>
              </div>
            </div>

            {/* Seats — compact strip on mobile */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-8 sm:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {table.seats.map((s, i) => {
                const amSeated = table.seats.some(
                  (x) => x?.wallet === wallet?.toLowerCase()
                );
                if (s && wallet) {
                  return (
                    <div
                      key={s.wallet}
                      className="w-[18vw] max-w-[72px] shrink-0 sm:w-auto sm:max-w-none"
                    >
                      <RouletteSeatVideo
                        tableId={table.id}
                        myWallet={wallet}
                        peerWallet={s.wallet}
                        isSelf={s.wallet === wallet.toLowerCase()}
                        label={s.displayName}
                        emoji={s.avatarEmoji}
                        camOn={camOn}
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={`e-${i}`}
                    type="button"
                    disabled={busy || amSeated}
                    onClick={() => void joinTable(table.id, i)}
                    className="flex aspect-square w-[18vw] max-w-[72px] shrink-0 items-center justify-center rounded-xl border border-dashed border-[#c9a227]/25 text-[9px] text-white/30 sm:w-auto sm:max-w-none sm:text-[10px]"
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Wheel — centered square, never clipped */}
            <div className="overflow-hidden rounded-2xl border border-[#c9a227]/30 bg-black/40 shadow-[0_0_40px_rgba(201,162,39,0.08)]">
              <div className="mx-auto aspect-square w-full max-w-[420px]">
                <RouletteWheel3D
                  targetNumber={table.lastSpin?.number ?? null}
                  spinning={table.phase === "spinning"}
                />
              </div>
              {(table.phase === "result" || table.phase === "spinning") &&
              table.lastSpin ? (
                <div className="space-y-1 border-t border-[#c9a227]/20 py-2.5 text-center">
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                    <span
                      className={
                        table.lastSpin.color === "red"
                          ? "text-red-400"
                          : table.lastSpin.color === "black"
                            ? "text-white"
                            : "text-emerald-400"
                      }
                    >
                      {table.lastSpin.number}
                    </span>
                    <span className="ml-2 text-xs font-normal uppercase tracking-[0.16em] text-white/45 sm:text-sm">
                      {table.lastSpin.color}
                    </span>
                  </p>
                  {table.phase === "result" && myNet ? (
                    <p
                      className={`text-sm font-semibold ${
                        myNet.net > 0
                          ? "text-emerald-400"
                          : myNet.net < 0
                            ? "text-red-400"
                            : "text-white/50"
                      }`}
                    >
                      {myNet.net > 0
                        ? `+${myNet.net} kazandın`
                        : myNet.net < 0
                          ? `${myNet.net} kaybettin`
                          : "Berabere"}
                      <span className="ml-2 text-[10px] font-normal text-white/35">
                        stake {myNet.staked} · dönüş {myNet.returned}
                      </span>
                    </p>
                  ) : table.phase === "result" && myBets.length === 0 ? (
                    <p className="text-[11px] text-white/40">
                      Bu turda bahsin yoktu
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#c9a227]/80">
                Last numbers
              </p>
              <RouletteHistory history={table.history || []} />
            </div>

            {/* Full board — scale-to-fit width */}
            <RouletteBoard
              disabled={busy || table.phase !== "betting"}
              chip={chip}
              onChip={setChip}
              bets={table.bets}
              myWallet={wallet}
              onBet={(b) => void place(b)}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || table.phase !== "betting"}
                className="border-[#c9a227]/35"
                onClick={() => void undo()}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Geri al
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || table.phase !== "betting"}
                className="border-[#c9a227]/35"
                onClick={() => void clearAll()}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Temizle
              </Button>
            </div>
            {myBets.length > 0 ? (
              <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-white/55">
                {myBets.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span>{b.label}</span>
                    <span className="font-mono text-[#ffe566]">{b.amount}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {isHost ? (
              <div className="flex flex-col gap-2">
                {(table.phase === "lobby" || table.phase === "result") &&
                !table.autoStart ? (
                  <Button
                    disabled={busy}
                    className="w-full bg-[#c9a227] text-[#1a1408] hover:bg-[#ffe566]"
                    onClick={() => void startRound()}
                  >
                    Bahisleri aç · 30 sn
                  </Button>
                ) : null}
                {(table.phase === "lobby" || table.phase === "result") &&
                table.autoStart ? (
                  <p className="text-center text-[11px] text-[#c9a227]/80">
                    Otomatik tur açık — sonuç bitince bahisler yeniden açılır
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void toggleAuto()}
                  className={`rounded-full border px-3 py-1.5 text-[11px] ${
                    table.autoStart
                      ? "border-[#c9a227]/50 bg-[#c9a227]/15 text-[#ffe566]"
                      : "border-white/20 text-white/45"
                  }`}
                >
                  Otomatik tur · {table.autoStart ? "Açık" : "Kapalı"}
                </button>
                {table.phase === "lobby" ? (
                  <Button
                    disabled={busy}
                    className="w-full bg-[#c9a227] text-[#1a1408] hover:bg-[#ffe566]"
                    onClick={() => void startRound()}
                  >
                    {table.autoStart
                      ? "İlk turu şimdi başlat"
                      : "Bahisleri aç · 30 sn"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!isHost && table.phase === "lobby" ? (
              <p className="text-center text-xs text-white/40">
                Host turu başlatınca bahis tahtası açılır.
              </p>
            ) : null}

            {inviteUrl ? (
              <button
                type="button"
                className="w-full truncate text-left font-mono text-[10px] text-white/35 hover:text-[#ffe566]"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl);
                  setFlash("Davet linki kopyalandı");
                  window.setTimeout(() => setFlash(null), 1600);
                }}
              >
                Davet · {inviteUrl}
              </button>
            ) : null}

            <p className="text-[10px] leading-relaxed text-white/30">
              Ödemeler: düz 35:1 · split 17:1 · street 11:1 · corner 8:1 · line
              5:1 · dozen/kolon 2:1 · dış bahisler 1:1. 0 dış bahisleri kaybeder.
              Commit–reveal ile spin kanıtı.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
