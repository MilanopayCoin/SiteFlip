"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Gift,
  MapPin,
  MessageCircle,
  Radio,
  Users,
  UserRound,
  Video,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  IncomingCallBanner,
  VideoCallAnswer,
  VideoCallPanel,
} from "@/components/near/video-call";
import {
  contributePlacePot,
  getNearToken,
  nearFetch,
  sendGiftOnChain,
  setNearToken,
  signInWithStarkey,
} from "@/lib/near/client";
import { GIFT_CATALOG, ICEBREAKERS } from "@/lib/near/gifts";
import {
  blockWallet,
  loadBlocked,
  MOOD_PRESETS,
  recordLocalReport,
  unblockWallet,
} from "@/lib/near/safety";
import type {
  NearCall,
  NearGiftBoardRow,
  NearGiftInboxItem,
  NearHotZone,
  NearPeer,
  NearPlacePot,
  NearProfile,
} from "@/lib/near/types";
import {
  shortAddress,
  STARKEY_INSTALL_URL,
  useStarkeyEvm,
} from "@/lib/starkey";

type Tab = "radar" | "room" | "chat" | "profile";

type ThreadRow = {
  id: string;
  peerWallet: string;
  lastBody?: string;
  updatedAt: string;
};

type Msg = {
  id: string;
  fromWallet: string;
  body: string;
  createdAt: string;
};

const SEEN_KEY = "jiy-near-thread-seen";

function loadSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function markThreadSeen(threadId: string, at: string) {
  const seen = loadSeen();
  seen[threadId] = at;
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export function NearApp() {
  const starkey = useStarkeyEvm();
  const [tab, setTab] = useState<Tab>("radar");
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NearProfile | null>(null);
  const [peers, setPeers] = useState<NearPeer[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [mood, setMood] = useState("");
  const [bio, setBio] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [pot, setPot] = useState<NearPlacePot | null>(null);
  const [drawWinner, setDrawWinner] = useState<string | null>(null);
  const [videoPeer, setVideoPeer] = useState<string | null>(null);
  const [answerCall, setAnswerCall] = useState<{
    id: string;
    from: string;
  } | null>(null);
  const [roomMsgs, setRoomMsgs] = useState<Msg[]>([]);
  const [roomHash, setRoomHash] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const [board, setBoard] = useState<NearGiftBoardRow[]>([]);
  const [giftFlash, setGiftFlash] = useState<string | null>(null);
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState<string[]>([]);
  const [pendingPeer, setPendingPeer] = useState<string | null>(null);
  const [inviteGeohash, setInviteGeohash] = useState<string | null>(null);
  const [hotZones, setHotZones] = useState<NearHotZone[]>([]);
  const [inbox, setInbox] = useState<NearGiftInboxItem[]>([]);
  const [waveOut, setWaveOut] = useState<Set<string>>(() => new Set());
  const [waveIn, setWaveIn] = useState<Set<string>>(() => new Set());
  const [waveMutual, setWaveMutual] = useState<Set<string>>(
    () => new Set()
  );

  const wallet = starkey.account;

  const applyWaveSummary = useCallback(
    (summary: {
      outgoing?: string[];
      incoming?: string[];
      mutual?: string[];
    }) => {
      setWaveOut(new Set((summary.outgoing || []).map((w) => w.toLowerCase())));
      setWaveIn(new Set((summary.incoming || []).map((w) => w.toLowerCase())));
      setWaveMutual(
        new Set((summary.mutual || []).map((w) => w.toLowerCase()))
      );
    },
    []
  );

  const refreshWaves = useCallback(async () => {
    try {
      const data = await nearFetch("/api/near/waves");
      if (data.summary) applyWaveSummary(data.summary);
    } catch {
      // ignore
    }
  }, [applyWaveSummary]);

  function isUnlocked(peer: string) {
    return waveMutual.has(peer.toLowerCase());
  }

  const refreshProfile = useCallback(async () => {
    const data = await nearFetch("/api/near/profile");
    if (data.profile) {
      setProfile(data.profile);
      setName(data.profile.displayName || "");
      setMood(data.profile.mood || "");
      setBio(data.profile.bio || "");
      setEmoji(data.profile.avatarEmoji || "✨");
    }
  }, []);

  const refreshPeers = useCallback(async () => {
    const data = await nearFetch("/api/near/presence");
    setPeers(data.peers || []);
    setHotZones(data.hotZones || []);
    if (data.me?.expiresAt) {
      setExpiresAt(data.me.expiresAt);
      setCheckedIn(true);
    } else if (data.me == null) {
      // only clear if server explicitly has no presence
      setExpiresAt(null);
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    try {
      const data = await nearFetch("/api/near/gifts?inbox=1");
      setInbox(data.inbox || []);
    } catch {
      setInbox([]);
    }
  }, []);

  const refreshPot = useCallback(async () => {
    try {
      const data = await nearFetch("/api/near/pots");
      setPot(data.pot || null);
      if (data.draw?.winnerWallet) setDrawWinner(data.draw.winnerWallet);
    } catch {
      setPot(null);
    }
  }, []);

  const refreshRoom = useCallback(async () => {
    try {
      const data = await nearFetch("/api/near/rooms");
      setRoomMsgs(data.messages || []);
      setRoomHash(data.geohash || null);
    } catch {
      setRoomMsgs([]);
      setRoomHash(null);
    }
  }, []);

  const refreshBoard = useCallback(async () => {
    try {
      const data = await nearFetch("/api/near/gifts?board=1");
      setBoard(data.leaderboard || []);
    } catch {
      setBoard([]);
    }
  }, []);

  async function runPotDraw() {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/pots", {
        method: "POST",
        body: JSON.stringify({ action: "draw" }),
      });
      setDrawWinner(data.draw?.winnerWallet || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendRoomMsg() {
    if (!roomDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await nearFetch("/api/near/rooms", {
        method: "POST",
        body: JSON.stringify({ text: roomDraft }),
      });
      setRoomDraft("");
      await refreshRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Room send failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !wallet || tab !== "room" || !checkedIn) return;
    void refreshRoom();
    const id = window.setInterval(() => void refreshRoom(), 4000);
    return () => window.clearInterval(id);
  }, [sessionReady, wallet, tab, checkedIn, refreshRoom]);

  const refreshThreads = useCallback(async () => {
    const data = await nearFetch("/api/near/threads");
    setThreads(data.threads || []);
  }, []);

  useEffect(() => {
    setSessionReady(Boolean(getNearToken()));
    setSeenMap(loadSeen());
    setBlocked(loadBlocked());
    try {
      const sp = new URLSearchParams(window.location.search);
      const peer = sp.get("peer");
      const g = sp.get("g");
      if (peer && /^0x[a-fA-F0-9]{40}$/.test(peer)) {
        setPendingPeer(peer.toLowerCase());
      }
      if (g && /^[0-9a-z]{3,12}$/i.test(g)) {
        setInviteGeohash(g.toLowerCase());
      }
    } catch {
      // ignore bad URL
    }
  }, []);

  useEffect(() => {
    if (!sessionReady || !wallet) return;
    void (async () => {
      try {
        await refreshProfile();
        await refreshPeers();
        await refreshThreads();
        await refreshBoard();
        await refreshInbox();
        await refreshWaves();
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Load failed";
        // Stale pre-HMAC tokens → force re-auth
        if (/unauthorized/i.test(msg)) {
          setNearToken(null);
          setSessionReady(false);
          setError("Oturum süresi doldu — StarKey ile tekrar giriş yap.");
          return;
        }
        setError(msg);
      }
    })();
  }, [
    sessionReady,
    wallet,
    refreshProfile,
    refreshPeers,
    refreshThreads,
    refreshBoard,
    refreshInbox,
    refreshWaves,
  ]);

  useEffect(() => {
    if (!sessionReady || !wallet) return;
    const id = window.setInterval(() => {
      void refreshThreads();
      void refreshBoard();
      void refreshInbox();
      void refreshWaves();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [
    sessionReady,
    wallet,
    refreshThreads,
    refreshBoard,
    refreshInbox,
    refreshWaves,
  ]);

  useEffect(() => {
    if (!activeThreadId || !sessionReady) return;
    let stop = false;
    const tick = async () => {
      try {
        const data = await nearFetch(
          `/api/near/threads?threadId=${encodeURIComponent(activeThreadId)}`
        );
        if (!stop) {
          setMsgs(data.messages || []);
          const last =
            data.messages?.[data.messages.length - 1]?.createdAt ||
            new Date().toISOString();
          markThreadSeen(activeThreadId, last);
          setSeenMap(loadSeen());
        }
      } catch {
        // ignore poll errors
      }
    };
    void tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [activeThreadId, sessionReady]);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      let addr = wallet;
      if (!addr) {
        addr = await starkey.connect();
      }
      if (!addr) throw new Error("StarKey bağlantısı iptal");
      await signInWithStarkey(addr);
      setSessionReady(true);
      await nearFetch("/api/near/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: name || shortAddress(addr),
          mood,
          bio,
          avatarEmoji: emoji,
        }),
      });
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckIn() {
    setError(null);
    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Konum desteklenmiyor"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      const next = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      const data = await nearFetch("/api/near/presence", {
        method: "POST",
        body: JSON.stringify({
          lat: next.lat,
          lng: next.lng,
          ttlMinutes: 45,
        }),
      });
      setCoords(next);
      setCheckedIn(true);
      setExpiresAt(data.presence?.expiresAt || null);
      if (inviteGeohash) {
        setInviteHint(
          `Check-in tamam · davet bölgesi ${inviteGeohash}`
        );
        window.setTimeout(() => setInviteHint(null), 2500);
        setInviteGeohash(null);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("g");
          url.searchParams.delete("from");
          window.history.replaceState({}, "", url.pathname + url.search);
        } catch {
          // ignore
        }
      }
      await refreshPeers();
      await refreshPot();
      await refreshRoom();
      setTab("radar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    try {
      await nearFetch("/api/near/presence", { method: "DELETE" });
      setCheckedIn(false);
      setPeers([]);
      setCoords(null);
      setExpiresAt(null);
      setRoomMsgs([]);
      setRoomHash(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setBusy(false);
    }
  }

  /** Keep presence alive while the app is open. */
  useEffect(() => {
    if (!sessionReady || !wallet || !checkedIn || !coords) return;
    const beat = async () => {
      try {
        const data = await nearFetch("/api/near/presence", {
          method: "POST",
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            ttlMinutes: 45,
          }),
        });
        setExpiresAt(data.presence?.expiresAt || null);
        await refreshPeers();
      } catch {
        // ignore transient heartbeat errors
      }
    };
    const id = window.setInterval(() => void beat(), 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [sessionReady, wallet, checkedIn, coords, refreshPeers]);

  async function shareInvite() {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://jiy.app";
    const params = new URLSearchParams();
    if (roomHash) params.set("g", roomHash);
    if (wallet) params.set("from", wallet.slice(0, 10));
    const qs = params.toString();
    const url = `${origin}/near/app${qs ? `?${qs}` : ""}`;
    const text = roomHash
      ? `JIY Near · ${roomHash} bölgesindeyim — StarKey ile check-in yap, radar’da buluşalım.`
      : "JIY Near’da şu an yakınımdayım — StarKey ile check-in yap, radar’da buluşalım.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "JIY Near", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setInviteHint("Davet linki kopyalandı");
        window.setTimeout(() => setInviteHint(null), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setInviteHint("Link kopyalandı");
        window.setTimeout(() => setInviteHint(null), 2000);
      } catch {
        setError("Paylaşım desteklenmiyor");
      }
    }
  }

  function hidePeer(peer: string) {
    setBlocked(blockWallet(peer));
    setInviteHint("Kişi gizlendi");
    window.setTimeout(() => setInviteHint(null), 1800);
  }

  function reportPeer(peer: string) {
    recordLocalReport(peer, "user-report");
    setBlocked(blockWallet(peer));
    setInviteHint("Bildirildi ve gizlendi");
    window.setTimeout(() => setInviteHint(null), 2000);
  }

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const minutesLeft = useMemo(() => {
    if (!expiresAt) return null;
    void tick;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 60_000);
  }, [expiresAt, tick]);

  const openChat = useCallback(async (peer: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/threads", {
        method: "POST",
        body: JSON.stringify({ peerWallet: peer }),
      });
      setActivePeer(peer);
      setActiveThreadId(data.thread.id);
      setTab("chat");
      await refreshThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat open failed");
    } finally {
      setBusy(false);
    }
  }, [refreshThreads]);

  useEffect(() => {
    if (!sessionReady || !wallet || !pendingPeer) return;
    const peer = pendingPeer;
    setPendingPeer(null);
    void openChat(peer).then(() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("peer");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {
        // ignore
      }
    });
  }, [sessionReady, wallet, pendingPeer, openChat]);

  async function sendMsg() {
    if (!draft.trim() || (!activeThreadId && !activePeer)) return;
    setBusy(true);
    try {
      await nearFetch("/api/near/threads", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeThreadId || undefined,
          peerWallet: activePeer || undefined,
          text: draft,
        }),
      });
      setDraft("");
      if (activeThreadId) {
        const data = await nearFetch(
          `/api/near/threads?threadId=${encodeURIComponent(activeThreadId)}`
        );
        setMsgs(data.messages || []);
      }
      await refreshThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendFreeWave(peer: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await nearFetch("/api/near/waves", {
        method: "POST",
        body: JSON.stringify({ toWallet: peer }),
      });
      if (data.summary) applyWaveSummary(data.summary);
      if (data.mutual) {
        setGiftFlash("Karşılıklı Selam — chat ve görüntülü açıldı");
      } else {
        setGiftFlash("Selam iletildi — karşılık bekleniyor");
      }
      window.setTimeout(() => setGiftFlash(null), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Selam failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendGift(peer: string, giftId: string) {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      await sendGiftOnChain({ from: wallet, to: peer, giftId });
      const item = GIFT_CATALOG.find((g) => g.id === giftId);
      setGiftFlash(
        `${item?.emoji || "🎁"} ${item?.label || "Hediye"} gönderildi`
      );
      window.setTimeout(() => setGiftFlash(null), 2200);
      await refreshBoard();
      await refreshInbox();
      await refreshWaves();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gift failed");
    } finally {
      setBusy(false);
    }
  }

  async function startVideo(peer: string) {
    if (!isUnlocked(peer)) {
      setError("Görüntülü için karşılıklı Selam gerekli");
      return;
    }
    setVideoPeer(peer);
  }

  async function sendIcebreaker(text: string) {
    setDraft(text);
    // auto-send for one-tap feel
    if (!activeThreadId && !activePeer) return;
    setBusy(true);
    try {
      await nearFetch("/api/near/threads", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeThreadId || undefined,
          peerWallet: activePeer || undefined,
          text,
        }),
      });
      setDraft("");
      if (activeThreadId) {
        const data = await nearFetch(
          `/api/near/threads?threadId=${encodeURIComponent(activeThreadId)}`
        );
        setMsgs(data.messages || []);
      }
      await refreshThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendToPot(giftId: string) {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      await contributePlacePot({ from: wallet, giftId });
      await refreshPot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pot gift failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const data = await nearFetch("/api/near/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: name,
          mood,
          bio,
          avatarEmoji: emoji,
        }),
      });
      setProfile(data.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function signOutLocal() {
    setNearToken(null);
    setSessionReady(false);
    setProfile(null);
    setPeers([]);
    starkey.disconnect();
  }

  const peerName = useMemo(() => {
    if (!activePeer) return "";
    const p = peers.find((x) => x.wallet === activePeer);
    return p?.displayName || shortAddress(activePeer);
  }, [activePeer, peers]);

  const scoreByWallet = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of board) m.set(row.wallet, row.score);
    return m;
  }, [board]);

  const rankedPeers = useMemo(() => {
    const blockedSet = new Set(blocked);
    return [...peers]
      .filter((p) => !blockedSet.has(p.wallet.toLowerCase()))
      .sort((a, b) => {
        const sa = scoreByWallet.get(a.wallet) || 0;
        const sb = scoreByWallet.get(b.wallet) || 0;
        if (sb !== sa) return sb - sa;
        return (a.distanceM ?? 9e9) - (b.distanceM ?? 9e9);
      });
  }, [peers, scoreByWallet, blocked]);

  const unreadChat = useMemo(() => {
    return threads.filter((t) => {
      if (t.id === activeThreadId) return false;
      const seen = seenMap[t.id];
      if (!seen) return Boolean(t.updatedAt);
      return new Date(t.updatedAt).getTime() > new Date(seen).getTime();
    }).length;
  }, [threads, seenMap, activeThreadId]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%)",
        }}
      />

      <header className="relative z-10 border-b border-border/80 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <Link
              href="/near"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent"
            >
              JIY Near
            </Link>
            <p className="font-display text-xl font-semibold tracking-tight">
              Şu an yakınımda
            </p>
          </div>
          {sessionReady && wallet ? (
            <button
              type="button"
              onClick={signOutLocal}
              className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted"
            >
              {shortAddress(wallet)}
            </button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-4 pb-28 pt-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {giftFlash ? (
          <p className="mb-4 animate-pulse rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {giftFlash}
          </p>
        ) : null}
        {inviteGeohash && !checkedIn ? (
          <p className="mb-4 rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm">
            Davet · bölge{" "}
            <span className="font-mono text-accent">{inviteGeohash}</span> —
            check-in yapınca aynı radar’da buluşursunuz.
          </p>
        ) : null}

        {sessionReady && wallet ? (
          <IncomingCallBanner
            myWallet={wallet}
            onAccept={(call: NearCall) => {
              setAnswerCall({ id: call.id, from: call.fromWallet });
            }}
          />
        ) : null}

        {!sessionReady || !wallet ? (
          <section className="space-y-5 rounded-2xl border border-border bg-surface/70 p-5">
            <p className="text-sm text-muted">
              StarKey ile gir — radar, chat ve hediyeler cüzdan kimliğine bağlı.
              Konum yalnızca check-in süresince (≈45 dk) kaba geohash olarak tutulur.
            </p>
            {starkey.status === "missing" ? (
              <Button asChild className="w-full">
                <a href={STARKEY_INSTALL_URL} target="_blank" rel="noreferrer">
                  <Wallet className="mr-2 h-4 w-4" />
                  StarKey indir
                </a>
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={busy || starkey.status === "connecting"}
                onClick={() => void handleSignIn()}
              >
                <Wallet className="mr-2 h-4 w-4" />
                {busy ? "İmzalanıyor…" : "StarKey ile giriş"}
              </Button>
            )}
            <p className="text-xs text-muted">
              Imza gas harcamaz. Hediyeler Supra Devnet SUPRA transferidir.
            </p>
          </section>
        ) : (
          <>
            {tab === "radar" && (
              <section className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {!checkedIn ? (
                    <Button disabled={busy} onClick={() => void handleCheckIn()}>
                      <Radio className="mr-2 h-4 w-4" />
                      Check-in (konum)
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleCheckOut()}
                    >
                      Check-out
                      {minutesLeft != null ? ` · ${minutesLeft}dk` : ""}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void refreshPeers();
                      void refreshPot();
                      void refreshBoard();
                    }}
                  >
                    Yenile
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void shareInvite()}
                  >
                    Davet et
                  </Button>
                </div>
                {inviteHint ? (
                  <p className="text-xs text-success">{inviteHint}</p>
                ) : null}

                {checkedIn && hotZones.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {hotZones.map((z) => (
                      <span
                        key={z.geohash}
                        className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                          z.mine
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-muted"
                        }`}
                      >
                        {z.mine ? "Sen · " : ""}
                        {z.geohash} · {z.count} aktif
                      </span>
                    ))}
                  </div>
                ) : null}

                {checkedIn &&
                [...waveIn].filter((w) => !waveMutual.has(w)).length > 0 ? (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      Gelen selam
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rankedPeers
                        .filter(
                          (p) =>
                            waveIn.has(p.wallet.toLowerCase()) &&
                            !waveMutual.has(p.wallet.toLowerCase())
                        )
                        .map((p) => (
                          <button
                            key={p.wallet}
                            type="button"
                            disabled={busy}
                            onClick={() => void sendFreeWave(p.wallet)}
                            className="rounded-full border border-accent/40 px-2.5 py-1 text-[11px]"
                          >
                            {p.avatarEmoji} {p.displayName.slice(0, 12)} · dön
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}

                {inbox.length > 0 ? (
                  <div className="rounded-xl border border-border bg-surface/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Bana gelen hediyeler
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {inbox.slice(0, 5).map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <button
                            type="button"
                            className="truncate text-left hover:text-accent"
                            onClick={() => void openChat(item.fromWallet)}
                          >
                            {item.giftEmoji} {item.fromEmoji} {item.fromName}
                          </button>
                          <span className="shrink-0 font-mono text-[10px] text-muted">
                            {item.giftLabel} · {item.amountSupra}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {checkedIn && board.length > 0 ? (
                  <div className="rounded-xl border border-border bg-surface/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Gece tahtı · hediye skoru
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      {board.slice(0, 5).map((row, i) => (
                        <li
                          key={row.wallet}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">
                            <span className="mr-1.5 font-mono text-[10px] text-muted">
                              #{i + 1}
                            </span>
                            {row.avatarEmoji} {row.displayName}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-accent">
                            {row.score} pts · {row.receivedCount}×
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {checkedIn && pot ? (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      Yer kasası
                    </p>
                    <p className="mt-1 text-sm">
                      Bu bölgeye {pot.giftCount} hediye · geohash{" "}
                      <span className="font-mono text-xs">{pot.geohash}</span>
                    </p>
                    {drawWinner ? (
                      <p className="mt-2 text-xs text-success">
                        Son çekiliş kazananı · {shortAddress(drawWinner)}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {GIFT_CATALOG.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void sendToPot(g.id)}
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-accent/50"
                        >
                          {g.emoji} Kasa · {g.amountSupra}
                        </button>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || pot.giftCount < 1}
                        onClick={() => void runPotDraw()}
                      >
                        Gece çekilişi
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!checkedIn ? (
                  <p className="text-sm text-muted">
                    Check-in yapınca yakındaki StarKey kullanıcıları görünür.
                    Süre dolunca radar’dan düşersin.
                  </p>
                ) : peers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-sm text-muted">
                      Henüz yakında kimse yok.
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Linki paylaş — aynı bölgede check-in yapan StarKey
                      kullanıcıları burada görünür. Yer odasına da yazabilirsin.
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      size="sm"
                      onClick={() => setTab("room")}
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                      Yer odasını aç
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {rankedPeers.map((p) => {
                      const score = scoreByWallet.get(p.wallet) || 0;
                      const boosted = score >= 10;
                      return (
                      <li
                        key={p.wallet}
                        className={`rounded-xl border bg-surface/60 p-4 ${
                          boosted
                            ? "border-accent/50 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg">
                              <span className="mr-2">{p.avatarEmoji}</span>
                              {p.displayName}
                              {boosted ? (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                  Boost
                                </span>
                              ) : null}
                            </p>
                            {p.mood ? (
                              <p className="text-sm text-muted">{p.mood}</p>
                            ) : null}
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                              <MapPin className="h-3 w-3" />
                              {p.distanceM != null
                                ? `≈ ${p.distanceM} m`
                                : "yakın"}
                              {score > 0 ? ` · ${score} pts` : ""}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {isUnlocked(p.wallet) ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openChat(p.wallet)}
                                >
                                  <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                  Chat
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => void startVideo(p.wallet)}
                                >
                                  <Video className="mr-1 h-3.5 w-3.5" />
                                  Görüntülü
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void sendFreeWave(p.wallet)}
                              >
                                👋{" "}
                                {waveOut.has(p.wallet.toLowerCase())
                                  ? "Bekleniyor…"
                                  : waveIn.has(p.wallet.toLowerCase())
                                    ? "Selam dön"
                                    : "Selam at"}
                              </Button>
                            )}
                          </div>
                        </div>
                        {!isUnlocked(p.wallet) ? (
                          <p className="mt-2 text-[11px] text-muted">
                            {waveOut.has(p.wallet.toLowerCase()) &&
                            !waveIn.has(p.wallet.toLowerCase())
                              ? "Selamın iletildi — karşı taraf Selam atınca chat açılır."
                              : waveIn.has(p.wallet.toLowerCase())
                                ? "Sana Selam attı — sen de at, kilit açılsın."
                                : "Chat / görüntülü için karşılıklı Selam veya Wave hediyesi."}
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-accent">
                            Karşılıklı Selam · açık
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {GIFT_CATALOG.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              disabled={busy}
                              onClick={() => void sendGift(p.wallet, g.id)}
                              className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-accent/50"
                              title={g.blurb}
                            >
                              {g.emoji} {g.label} · {g.amountSupra} SUPRA
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex gap-3 text-[10px] text-muted">
                          <button
                            type="button"
                            className="hover:text-foreground"
                            onClick={() => hidePeer(p.wallet)}
                          >
                            Gizle
                          </button>
                          <button
                            type="button"
                            className="hover:text-danger"
                            onClick={() => reportPeer(p.wallet)}
                          >
                            Bildir
                          </button>
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {tab === "chat" && (
              <section className="space-y-3">
                {!activeThreadId ? (
                  <ul className="space-y-2">
                    {threads.length === 0 ? (
                      <p className="text-sm text-muted">
                        Henüz sohbet yok — radar’dan birine yaz.
                      </p>
                    ) : (
                      threads.map((t) => {
                        const unread =
                          t.id !== activeThreadId &&
                          (!seenMap[t.id] ||
                            new Date(t.updatedAt).getTime() >
                              new Date(seenMap[t.id]).getTime());
                        return (
                        <button
                          key={t.id}
                          type="button"
                          className={`flex w-full flex-col rounded-xl border px-3 py-3 text-left hover:border-accent/40 ${
                            unread
                              ? "border-accent/40 bg-accent/5"
                              : "border-border"
                          }`}
                          onClick={() => {
                            setActiveThreadId(t.id);
                            setActivePeer(t.peerWallet);
                            markThreadSeen(t.id, t.updatedAt || new Date().toISOString());
                            setSeenMap(loadSeen());
                          }}
                        >
                          <span className="flex items-center justify-between gap-2 font-medium">
                            {shortAddress(t.peerWallet)}
                            {unread ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                            ) : null}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {t.lastBody || "—"}
                          </span>
                        </button>
                        );
                      })
                    )}
                  </ul>
                ) : (
                  <div className="flex h-[55dvh] flex-col rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <p className="text-sm font-medium">{peerName}</p>
                      <button
                        type="button"
                        className="text-xs text-muted"
                        onClick={() => {
                          setActiveThreadId(null);
                          setMsgs([]);
                        }}
                      >
                        Geri
                      </button>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                      {activePeer && !isUnlocked(activePeer) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                          <p className="text-sm text-muted">
                            Bu sohbet kilitli — karşılıklı Selam gerekir.
                          </p>
                          <Button
                            disabled={busy}
                            onClick={() => void sendFreeWave(activePeer)}
                          >
                            👋{" "}
                            {waveOut.has(activePeer.toLowerCase())
                              ? "Selam iletildi"
                              : "Selam at (ücretsiz)"}
                          </Button>
                          <button
                            type="button"
                            disabled={busy}
                            className="text-[11px] text-accent"
                            onClick={() => void sendGift(activePeer, "wave")}
                          >
                            veya Wave hediyesi gönder (0.1 SUPRA)
                          </button>
                        </div>
                      ) : msgs.length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-center text-xs text-muted">
                            İlk mesajı sen at — hazır cümleler:
                          </p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {ICEBREAKERS.map((line) => (
                              <button
                                key={line}
                                type="button"
                                disabled={busy}
                                onClick={() => void sendIcebreaker(line)}
                                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-foreground"
                              >
                                {line}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        msgs.map((m) => (
                          <div
                            key={m.id}
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              m.fromWallet === wallet
                                ? "ml-auto bg-accent text-accent-ink"
                                : "bg-surface text-foreground"
                            }`}
                          >
                            {m.body}
                          </div>
                        ))
                      )}
                    </div>
                    {activePeer && isUnlocked(activePeer) ? (
                      <>
                        <div className="flex gap-2 border-t border-border p-2">
                          <Input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Mesaj…"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void sendMsg();
                            }}
                          />
                          <Button
                            disabled={busy}
                            onClick={() => void sendMsg()}
                          >
                            Gönder
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 border-t border-border px-2 py-2">
                          {GIFT_CATALOG.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              disabled={busy}
                              onClick={() => void sendGift(activePeer, g.id)}
                              className="rounded-full border border-border px-2 py-0.5 text-[11px]"
                            >
                              <Gift className="mr-1 inline h-3 w-3" />
                              {g.emoji} {g.amountSupra}
                            </button>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void startVideo(activePeer)}
                          >
                            <Video className="mr-1 h-3.5 w-3.5" />
                            Görüntülü
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </section>
            )}

            {tab === "room" && (
              <section className="space-y-3">
                {!checkedIn ? (
                  <p className="text-sm text-muted">
                    Yer odası için önce radar’dan check-in yap.
                  </p>
                ) : (
                  <div className="flex h-[55dvh] flex-col rounded-xl border border-border">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-sm font-medium">Yer odası</p>
                      <p className="font-mono text-[10px] text-muted">
                        geohash {roomHash || "—"} · check-in süresince ortak
                        {minutesLeft != null ? ` · ${minutesLeft}dk` : ""}
                      </p>
                      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                        <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px]">
                          {emoji} Sen
                        </span>
                        {rankedPeers.slice(0, 12).map((p) => (
                          <button
                            key={p.wallet}
                            type="button"
                            onClick={() => void openChat(p.wallet)}
                            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted"
                            title={p.displayName}
                          >
                            {p.avatarEmoji} {p.displayName.slice(0, 10)}
                          </button>
                        ))}
                        {rankedPeers.length === 0 ? (
                          <span className="text-[10px] text-muted">
                            Henüz başka üye yok
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                      {roomMsgs.length === 0 ? (
                        <p className="text-center text-xs text-muted">
                          İlk mesajı sen yaz — yakındakiler görür.
                        </p>
                      ) : (
                        roomMsgs.map((m) => (
                          <div
                            key={m.id}
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              m.fromWallet === wallet
                                ? "ml-auto bg-accent text-accent-ink"
                                : "bg-surface text-foreground"
                            }`}
                          >
                            {m.fromWallet !== wallet ? (
                              <p className="mb-0.5 font-mono text-[10px] opacity-70">
                                {shortAddress(m.fromWallet)}
                              </p>
                            ) : null}
                            {m.body}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 border-t border-border p-2">
                      <Input
                        value={roomDraft}
                        onChange={(e) => setRoomDraft(e.target.value)}
                        placeholder="Yer odasına yaz…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void sendRoomMsg();
                        }}
                      />
                      <Button
                        disabled={busy}
                        onClick={() => void sendRoomMsg()}
                      >
                        Gönder
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === "profile" && (
              <section className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted">Emoji</label>
                  <Input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted">İsim</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted">Mood</label>
                  <Input
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="Kahve / sohbet / …"
                    maxLength={48}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {MOOD_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMood(m)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] ${
                          mood === m
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {blocked.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-xs text-muted">
                      Gizlenen ({blocked.length})
                    </p>
                    <ul className="space-y-1">
                      {blocked.map((w) => (
                        <li
                          key={w}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono">{shortAddress(w)}</span>
                          <button
                            type="button"
                            className="text-accent"
                            onClick={() => setBlocked(unblockWallet(w))}
                          >
                            Göster
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-xs text-muted">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={160}
                    rows={3}
                  />
                </div>
                <Button disabled={busy} onClick={() => void saveProfile()}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Kaydet
                </Button>
                {profile ? (
                  <p className="font-mono text-[11px] text-muted">
                    {profile.wallet}
                  </p>
                ) : null}
              </section>
            )}
          </>
        )}
      </main>

      {sessionReady && wallet ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
            {(
              [
                ["radar", Radio, "Radar"],
                ["room", Users, "Oda"],
                ["chat", MessageCircle, "Chat"],
                ["profile", UserRound, "Profil"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-[11px] ${
                  tab === id ? "text-accent" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {id === "chat" && unreadChat > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-accent-ink">
                      {unreadChat > 9 ? "9+" : unreadChat}
                    </span>
                  ) : null}
                </span>
                {label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      {videoPeer && wallet ? (
        <VideoCallPanel
          myWallet={wallet}
          peerWallet={videoPeer}
          onClose={() => setVideoPeer(null)}
        />
      ) : null}

      {answerCall && wallet ? (
        <VideoCallAnswer
          callId={answerCall.id}
          peerWallet={answerCall.from}
          onClose={() => setAnswerCall(null)}
        />
      ) : null}
    </div>
  );
}
