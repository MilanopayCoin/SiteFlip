"use client";

import { useEffect, useRef, useState } from "react";
import { nearFetch } from "@/lib/near/client";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Mesh: polite peer = lexicographically smaller wallet.
 * Each seated player connects to every other seated wallet.
 */
export function RouletteSeatVideo({
  tableId,
  myWallet,
  peerWallet,
  isSelf,
  label,
  emoji,
  camOn,
}: {
  tableId: string;
  myWallet: string;
  peerWallet: string;
  isSelf: boolean;
  label: string;
  emoji: string;
  camOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const afterRef = useRef(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!isSelf || !camOn) {
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    let stop = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setLive(true);
      } catch {
        setLive(false);
      }
    })();
    return () => {
      stop = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [isSelf, camOn]);

  useEffect(() => {
    if (isSelf || !camOn) return;
    let cancelled = false;
    const polite = myWallet.toLowerCase() < peerWallet.toLowerCase();
    let makingOffer = false;

    const ensurePc = async () => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void nearFetch("/api/near/roulette", {
          method: "POST",
          body: JSON.stringify({
            action: "signal",
            tableId,
            toWallet: peerWallet,
            kind: "ice",
            payload: ev.candidate.toJSON(),
          }),
        });
      };
      pc.ontrack = (ev) => {
        if (videoRef.current) {
          videoRef.current.srcObject = ev.streams[0] || null;
          setLive(true);
        }
      };
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localRef.current = stream;
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      } catch {
        // no local cam — still receive
      }
      return pc;
    };

    const maybeOffer = async () => {
      if (polite) return;
      const pc = await ensurePc();
      if (makingOffer) return;
      makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await nearFetch("/api/near/roulette", {
          method: "POST",
          body: JSON.stringify({
            action: "signal",
            tableId,
            toWallet: peerWallet,
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
          `/api/near/roulette?tableId=${encodeURIComponent(tableId)}&signals=1&after=${afterRef.current}`
        );
        for (const sig of data.signals || []) {
          afterRef.current = Math.max(afterRef.current, sig.id);
          if (sig.fromWallet !== peerWallet.toLowerCase()) continue;
          const pc = await ensurePc();
          if (sig.kind === "offer") {
            await pc.setRemoteDescription(sig.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await nearFetch("/api/near/roulette", {
              method: "POST",
              body: JSON.stringify({
                action: "signal",
                tableId,
                toWallet: peerWallet,
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
        // ignore poll errors
      }
    };

    void maybeOffer();
    const id = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      pcRef.current?.close();
      pcRef.current = null;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [isSelf, camOn, tableId, myWallet, peerWallet]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/50">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`h-full w-full object-cover ${live ? "" : "opacity-0"}`}
      />
      {!live ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-2xl">{emoji}</span>
          <span className="px-1 text-[10px] text-white/60">{label}</span>
        </div>
      ) : (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/90">
          {label}
        </span>
      )}
    </div>
  );
}
