"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nearFetch } from "@/lib/near/client";
import type { VoiceParticipant, VoiceRoom } from "@/lib/near/voice";
import { shortAddress } from "@/lib/starkey";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function VoicePeerAudio({
  roomId,
  myWallet,
  peer,
  localStream,
}: {
  roomId: string;
  myWallet: string;
  peer: VoiceParticipant;
  localStream: MediaStream | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const afterRef = useRef(0);

  useEffect(() => {
    if (peer.wallet === myWallet.toLowerCase()) return;
    let cancelled = false;
    const polite = myWallet.toLowerCase() < peer.wallet;
    let makingOffer = false;

    const ensurePc = async () => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void nearFetch("/api/near/voice", {
          method: "POST",
          body: JSON.stringify({
            action: "signal",
            roomId,
            toWallet: peer.wallet,
            kind: "ice",
            payload: ev.candidate.toJSON(),
          }),
        });
      };
      pc.ontrack = (ev) => {
        if (audioRef.current) {
          audioRef.current.srcObject = ev.streams[0] || null;
          void audioRef.current.play().catch(() => undefined);
        }
      };
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      }
      return pc;
    };

    const maybeOffer = async () => {
      if (polite || peer.muted) return;
      const pc = await ensurePc();
      if (makingOffer) return;
      makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await nearFetch("/api/near/voice", {
          method: "POST",
          body: JSON.stringify({
            action: "signal",
            roomId,
            toWallet: peer.wallet,
            kind: "offer",
            payload: pc.localDescription,
          }),
        });
      } finally {
        makingOffer = false;
      }
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await nearFetch(
          `/api/near/voice?roomId=${encodeURIComponent(roomId)}&signals=1&after=${afterRef.current}`
        );
        for (const sig of data.signals || []) {
          afterRef.current = Math.max(afterRef.current, sig.id);
          if (sig.fromWallet !== peer.wallet) continue;
          const pc = await ensurePc();
          if (sig.kind === "offer") {
            await pc.setRemoteDescription(sig.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await nearFetch("/api/near/voice", {
              method: "POST",
              body: JSON.stringify({
                action: "signal",
                roomId,
                toWallet: peer.wallet,
                kind: "answer",
                payload: pc.localDescription,
              }),
            });
          } else if (sig.kind === "answer") {
            if (!pc.currentRemoteDescription) {
              await pc.setRemoteDescription(sig.payload);
            }
          } else if (sig.kind === "ice") {
            try {
              await pc.addIceCandidate(sig.payload);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    };

    void maybeOffer();
    const id = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [roomId, myWallet, peer.wallet, peer.muted, localStream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export function NearVoicePanel({
  wallet,
  displayName,
  avatarEmoji,
  geohashHint,
}: {
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  geohashHint?: string | null;
}) {
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [label, setLabel] = useState("Near Live");
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const refreshList = useCallback(async () => {
    const data = await nearFetch("/api/near/voice");
    setRooms(data.rooms || []);
  }, []);

  const refreshRoom = useCallback(async (id: string) => {
    const data = await nearFetch(
      `/api/near/voice?roomId=${encodeURIComponent(id)}`
    );
    setRoom(data.room);
  }, []);

  useEffect(() => {
    void refreshList().catch(() => undefined);
  }, [refreshList]);

  useEffect(() => {
    if (!room?.id) return;
    const id = window.setInterval(() => {
      void refreshRoom(room.id).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [room?.id, refreshRoom]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function ensureMic() {
    if (streamRef.current) return streamRef.current;
    const s = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    streamRef.current = s;
    setStream(s);
    return s;
  }

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      await ensureMic();
      const data = await nearFetch("/api/near/voice", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          label,
          displayName,
          avatarEmoji,
          usePresence: true,
        }),
      });
      setRoom(data.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oda açılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function join(id: string) {
    setBusy(true);
    setError(null);
    try {
      await ensureMic();
      const data = await nearFetch("/api/near/voice", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          roomId: id,
          displayName,
          avatarEmoji,
        }),
      });
      setRoom(data.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Katılım başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!room) return;
    setBusy(true);
    try {
      await nearFetch("/api/near/voice", {
        method: "POST",
        body: JSON.stringify({ action: "leave", roomId: room.id }),
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setRoom(null);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ayrılma başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMute() {
    if (!room) return;
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    try {
      const data = await nearFetch("/api/near/voice", {
        method: "POST",
        body: JSON.stringify({
          action: "mute",
          roomId: room.id,
          muted: next,
        }),
      });
      setRoom(data.room);
    } catch {
      setMuted(!next);
    }
  }

  if (!room) {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            Sesli odalar · Telegram Live
          </p>
          <p className="mt-1 text-sm text-muted">
            Yakınlık odası — mikrofona geç, 3D hediye at, konuş.
            {geohashHint ? (
              <span className="ml-1 font-mono text-[10px]">· {geohashHint}</span>
            ) : null}
          </p>
        </div>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 40))}
            className="flex-1"
            placeholder="Oda adı"
          />
          <Button disabled={busy} onClick={() => void createRoom()}>
            <Radio className="mr-1.5 h-4 w-4" />
            Aç
          </Button>
        </div>
        <ul className="space-y-2">
          {rooms.length === 0 ? (
            <li className="text-sm text-muted">Henüz sesli oda yok</li>
          ) : (
            rooms.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-3 text-left hover:border-accent/40"
                  onClick={() => void join(r.id)}
                >
                  <span>
                    🎙️ {r.label}{" "}
                    <span className="font-mono text-[10px] text-muted">
                      {r.id}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {r.participants.length}/12
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            Canlı · {room.label}
          </p>
          <p className="font-mono text-[10px] text-muted">
            {room.id}
            {room.geohash ? ` · ${room.geohash}` : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void leave()}>
          <PhoneOff className="mr-1 h-3.5 w-3.5" />
          Çık
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {room.participants.map((p) => {
          const me = p.wallet === wallet.toLowerCase();
          return (
            <div
              key={p.wallet}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 ${
                p.speaking
                  ? "border-accent bg-accent/10 shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                  : "border-border bg-surface/60"
              }`}
            >
              <span className="text-3xl">{p.avatarEmoji}</span>
              <span className="mt-1 truncate text-[11px] font-medium">
                {me ? "Sen" : p.displayName.slice(0, 10)}
              </span>
              <span className="text-[9px] text-muted">
                {p.muted ? "sessiz" : shortAddress(p.wallet)}
              </span>
              {!me ? (
                <VoicePeerAudio
                  roomId={room.id}
                  myWallet={wallet}
                  peer={p}
                  localStream={stream}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-3">
        <Button
          size="lg"
          variant={muted ? "outline" : "default"}
          className="h-14 w-14 rounded-full"
          onClick={() => void toggleMute()}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted">
        Telegram tarzı sesli oda · max 12 · hediyeler chat/radar’dan
      </p>
    </section>
  );
}
