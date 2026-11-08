"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, CameraOff, Spade, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getNearToken,
  nearFetch,
  setNearToken,
  signInWithStarkey,
} from "@/lib/near/client";
import type { RoulettePublic } from "@/lib/near/roulette";
import { RouletteSeatVideo } from "@/components/near/roulette-seat-video";
import {
  shortAddress,
  STARKEY_INSTALL_URL,
  useStarkeyEvm,
} from "@/lib/starkey";

const RouletteWheel3D = dynamic(
  () =>
    import("@/components/near/roulette-wheel-3d").then((m) => m.RouletteWheel3D),
  { ssr: false, loading: () => (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-white/40">
      Çark yükleniyor…
    </div>
  ) }
);

export function RouletteApp({ initialTableId }: { initialTableId?: string }) {
  const starkey = useStarkeyEvm();
  const wallet = starkey.account;
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<RoulettePublic | null>(null);
  const [tables, setTables] = useState<RoulettePublic[]>([]);
  const [name, setName] = useState("Oyuncu");
  const [emoji, setEmoji] = useState("🎰");
  const [betAmt, setBetAmt] = useState(50);
  const [camOn, setCamOn] = useState(false);
  const [joinId, setJoinId] = useState(initialTableId || "");

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
    }, 1500);
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
          label: "Near Rulet",
        }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Masa açılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function joinTable(id: string) {
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

  async function bet(color: "red" | "black") {
    if (!table) return;
    setBusy(true);
    try {
      const data = await nearFetch("/api/near/roulette", {
        method: "POST",
        body: JSON.stringify({
          action: "bet",
          tableId: table.id,
          color,
          amount: betAmt,
        }),
      });
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bahis başarısız");
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

  const myBal = useMemo(() => {
    if (!table || !wallet) return 0;
    return table.balances[wallet.toLowerCase()] ?? 0;
  }, [table, wallet]);

  const isHost =
    table && wallet && table.hostWallet === wallet.toLowerCase();

  const phaseLabel =
    table?.phase === "lobby"
      ? "Lobi — host turu başlatır"
      : table?.phase === "betting"
        ? "Bahis açık"
        : table?.phase === "spinning"
          ? "Çark dönüyor…"
          : table?.phase === "result"
            ? "Sonuç"
            : "";

  const inviteUrl =
    typeof window !== "undefined" && table
      ? `${window.location.origin}/near/rulet/${table.id}`
      : "";

  return (
    <div className="min-h-[100dvh] bg-[#070908] text-[#f2f2f0]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,255,58,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(185,28,28,0.12), transparent 50%)",
        }}
      />

      <header className="relative z-10 border-b border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/near"
              className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4ff3a]">
                JIY Near · Rulet
              </p>
              <p className="font-semibold tracking-tight">Görüntülü masa</p>
            </div>
          </div>
          {sessionReady && wallet ? (
            <button
              type="button"
              className="font-mono text-[11px] text-white/50"
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

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-5 pb-28">
        {error ? (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {!sessionReady || !wallet ? (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">
              StarKey ile gir — 3D çark, koltuklar ve görüntülü rulet masası
              cüzdan kimliğine bağlı. İlk sürümde <strong>demo chip</strong>{" "}
              (1000) ile oynanır; commit–reveal adil spin.
            </p>
            {starkey.status === "missing" ? (
              <Button asChild className="w-full bg-[#d4ff3a] text-[#0a0a0b]">
                <a href={STARKEY_INSTALL_URL} target="_blank" rel="noreferrer">
                  StarKey indir
                </a>
              </Button>
            ) : (
              <Button
                className="w-full bg-[#d4ff3a] text-[#0a0a0b]"
                disabled={busy}
                onClick={() => void handleSignIn()}
              >
                StarKey ile giriş
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
                className="max-w-[160px] border-white/15 bg-black/30"
              />
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="w-16 border-white/15 bg-black/30"
              />
            </div>
            <Button
              disabled={busy}
              className="bg-[#d4ff3a] text-[#0a0a0b]"
              onClick={() => void createTable()}
            >
              <Spade className="mr-2 h-4 w-4" />
              Masa aç
            </Button>
            <div className="flex gap-2">
              <Input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.trim())}
                placeholder="Masa kodu"
                className="border-white/15 bg-black/30 font-mono text-sm"
              />
              <Button
                variant="outline"
                disabled={busy || !joinId}
                className="border-white/20"
                onClick={() => void joinTable(joinId)}
              >
                Katıl
              </Button>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-white/50">
                <Users className="h-3.5 w-3.5" /> Açık masalar
              </p>
              <ul className="space-y-2">
                {tables.length === 0 ? (
                  <li className="text-sm text-white/40">Henüz masa yok</li>
                ) : (
                  tables.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-left hover:border-[#d4ff3a]/40"
                        onClick={() => void joinTable(t.id)}
                      >
                        <span>
                          {t.label}{" "}
                          <span className="font-mono text-[10px] text-white/40">
                            {t.id}
                          </span>
                        </span>
                        <span className="text-xs text-white/50">
                          {t.seats.filter(Boolean).length}/6 · {t.phase}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{table.label}</p>
                <p className="font-mono text-[10px] text-white/40">
                  {table.id} · tur #{table.round} · {phaseLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20"
                  onClick={() => void toggleCam()}
                >
                  {camOn ? (
                    <CameraOff className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Camera className="mr-1 h-3.5 w-3.5" />
                  )}
                  Kamera
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20"
                  onClick={() => void leave()}
                >
                  Ayrıl
                </Button>
              </div>
            </div>

            <p className="text-sm text-[#d4ff3a]">
              Chip · {myBal}
              {table.commitHash ? (
                <span className="ml-2 font-mono text-[9px] text-white/35">
                  commit {table.commitHash.slice(0, 10)}…
                </span>
              ) : null}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {table.seats.map((s, i) => {
                const amSeated = table.seats.some(
                  (x) => x?.wallet === wallet?.toLowerCase()
                );
                if (s && wallet) {
                  return (
                    <RouletteSeatVideo
                      key={s.wallet}
                      tableId={table.id}
                      myWallet={wallet}
                      peerWallet={s.wallet}
                      isSelf={s.wallet === wallet.toLowerCase()}
                      label={s.displayName}
                      emoji={s.avatarEmoji}
                      camOn={camOn}
                    />
                  );
                }
                return (
                  <button
                    key={`empty-${i}`}
                    type="button"
                    disabled={busy || amSeated}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const data = await nearFetch("/api/near/roulette", {
                            method: "POST",
                            body: JSON.stringify({
                              action: "join",
                              tableId: table.id,
                              displayName: name,
                              avatarEmoji: emoji,
                              seatIndex: i,
                            }),
                          });
                          setTable(data.table);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Koltuk dolu"
                          );
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-white/15 text-[10px] text-white/35"
                  >
                    Koltuk {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="h-[min(52vw,360px)] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <RouletteWheel3D
                targetNumber={table.lastSpin?.number ?? null}
                spinning={table.phase === "spinning"}
              />
            </div>

            {table.phase === "result" && table.lastSpin ? (
              <p className="text-center text-lg">
                <span
                  className={
                    table.lastSpin.color === "red"
                      ? "text-red-400"
                      : table.lastSpin.color === "black"
                        ? "text-white"
                        : "text-emerald-400"
                  }
                >
                  {table.lastSpin.number} · {table.lastSpin.color}
                </span>
              </p>
            ) : null}

            {table.phase === "betting" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={500}
                  value={betAmt}
                  onChange={(e) => setBetAmt(Number(e.target.value) || 50)}
                  className="w-24 border-white/15 bg-black/30"
                />
                <Button
                  disabled={busy}
                  className="bg-red-600 hover:bg-red-500"
                  onClick={() => void bet("red")}
                >
                  Kırmızı
                </Button>
                <Button
                  disabled={busy}
                  className="bg-zinc-900 hover:bg-zinc-800"
                  onClick={() => void bet("black")}
                >
                  Siyah
                </Button>
              </div>
            ) : null}

            {isHost && (table.phase === "lobby" || table.phase === "result") ? (
              <Button
                disabled={busy}
                className="w-full bg-[#d4ff3a] text-[#0a0a0b]"
                onClick={() => void startRound()}
              >
                Turu başlat (25sn bahis)
              </Button>
            ) : null}

            {inviteUrl ? (
              <button
                type="button"
                className="w-full truncate text-left font-mono text-[10px] text-white/40 hover:text-[#d4ff3a]"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                Davet · {inviteUrl}
              </button>
            ) : null}

            {table.bets.length > 0 ? (
              <ul className="space-y-1 text-xs text-white/50">
                {table.bets.map((b) => (
                  <li key={b.id}>
                    {shortAddress(b.wallet)} · {b.color} · {b.amount}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
