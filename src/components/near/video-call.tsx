"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nearFetch } from "@/lib/near/client";
import { shortAddress } from "@/lib/starkey";
import type { NearCall, NearCallSignal } from "@/lib/near/types";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VideoCallPanel({
  myWallet,
  peerWallet,
  onClose,
}: {
  myWallet: string;
  peerWallet: string;
  onClose: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const afterIdRef = useRef(0);
  const callIdRef = useRef<string | null>(null);
  const makingOffer = useRef(false);

  const [call, setCall] = useState<NearCall | null>(null);
  const [status, setStatus] = useState("Bağlanıyor…");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(async (sendHangup: boolean) => {
    const callId = callIdRef.current;
    if (sendHangup && callId) {
      try {
        await nearFetch("/api/near/calls", {
          method: "POST",
          body: JSON.stringify({
            callId,
            kind: "hangup",
            payload: {},
          }),
        });
      } catch {
        // ignore
      }
    }
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const ensurePc = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !callIdRef.current) return;
      void nearFetch("/api/near/calls", {
        method: "POST",
        body: JSON.stringify({
          callId: callIdRef.current,
          kind: "ice",
          payload: ev.candidate.toJSON(),
        }),
      });
    };

    pc.ontrack = (ev) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = ev.streams[0] || null;
      }
      setStatus("Bağlandı");
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("Bağlantı koptu");
      }
      if (pc.connectionState === "connected") setStatus("Bağlandı");
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    streamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
    return pc;
  }, []);

  const handleSignal = useCallback(
    async (sig: NearCallSignal) => {
      const pc = await ensurePc();
      if (sig.kind === "offer") {
        await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await nearFetch("/api/near/calls", {
          method: "POST",
          body: JSON.stringify({
            callId: callIdRef.current,
            kind: "answer",
            payload: answer,
          }),
        });
        setStatus("Cevaplandı");
      } else if (sig.kind === "answer") {
        await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
        setStatus("Bağlandı");
      } else if (sig.kind === "ice") {
        try {
          await pc.addIceCandidate(sig.payload as RTCIceCandidateInit);
        } catch {
          // ignore out-of-order
        }
      } else if (sig.kind === "hangup") {
        setStatus("Karşı taraf kapattı");
        await cleanup(false);
      }
    },
    [cleanup, ensurePc]
  );

  useEffect(() => {
    let stop = false;

    (async () => {
      try {
        setStatus("Aranıyor…");
        const { call: created } = await nearFetch("/api/near/calls", {
          method: "POST",
          body: JSON.stringify({ peerWallet }),
        });
        if (stop) return;
        callIdRef.current = created.id;
        setCall(created);

        const pc = await ensurePc();
        makingOffer.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await nearFetch("/api/near/calls", {
          method: "POST",
          body: JSON.stringify({
            callId: created.id,
            kind: "offer",
            payload: offer,
          }),
        });
        makingOffer.current = false;
        setStatus("Teklif gönderildi — cevap bekleniyor");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Call failed");
      }
    })();

    const poll = window.setInterval(() => {
      const callId = callIdRef.current;
      if (!callId || stop) return;
      void (async () => {
        try {
          const data = await nearFetch(
            `/api/near/calls?callId=${encodeURIComponent(callId)}&after=${afterIdRef.current}`
          );
          if (data.call) setCall(data.call);
          for (const sig of data.signals || []) {
            afterIdRef.current = Math.max(afterIdRef.current, sig.id);
            await handleSignal(sig);
          }
        } catch {
          // ignore
        }
      })();
    }, 1200);

    return () => {
      stop = true;
      window.clearInterval(poll);
      void cleanup(true);
    };
  }, [peerWallet, ensurePc, handleSignal, cleanup]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3 text-white">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm">
          <Video className="mr-1 inline h-4 w-4" />
          {shortAddress(peerWallet)} · {status}
        </p>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            void cleanup(true).then(onClose);
          }}
        >
          <PhoneOff className="mr-1 h-4 w-4" />
          Kapat
        </Button>
      </div>
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      <div className="relative min-h-0 flex-1">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full rounded-xl bg-zinc-900 object-cover"
        />
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-3 right-3 h-36 w-28 rounded-lg border border-white/20 object-cover"
        />
      </div>
      {call ? (
        <p className="mt-2 font-mono text-[10px] text-white/50">
          call {call.id} · {call.status}
        </p>
      ) : null}
    </div>
  );
}

export function IncomingCallBanner({
  myWallet,
  onAccept,
}: {
  myWallet: string;
  onAccept: (call: NearCall, fromWallet: string) => void;
}) {
  const [incoming, setIncoming] = useState<NearCall[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const data = await nearFetch("/api/near/calls");
          setIncoming(data.incoming || []);
        } catch {
          // ignore
        }
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [myWallet]);

  if (!incoming.length) return null;
  const call = incoming[0];

  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
      <p className="text-sm">
        <Phone className="mr-1 inline h-4 w-4 text-accent" />
        Gelen görüntülü · {shortAddress(call.fromWallet)}
      </p>
      <Button size="sm" onClick={() => onAccept(call, call.fromWallet)}>
        Aç
      </Button>
    </div>
  );
}

/** Callee joins an existing ringing call (answer side). */
export function VideoCallAnswer({
  callId,
  peerWallet,
  onClose,
}: {
  callId: string;
  peerWallet: string;
  onClose: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const afterIdRef = useRef(0);
  const [status, setStatus] = useState("Katılıyor…");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(async (sendHangup: boolean) => {
    if (sendHangup) {
      try {
        await nearFetch("/api/near/calls", {
          method: "POST",
          body: JSON.stringify({ callId, kind: "hangup", payload: {} }),
        });
      } catch {
        // ignore
      }
    }
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [callId]);

  useEffect(() => {
    let stop = false;
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      void nearFetch("/api/near/calls", {
        method: "POST",
        body: JSON.stringify({
          callId,
          kind: "ice",
          payload: ev.candidate.toJSON(),
        }),
      });
    };
    pc.ontrack = (ev) => {
      if (remoteRef.current) remoteRef.current.srcObject = ev.streams[0] || null;
      setStatus("Bağlandı");
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (stop) return;
        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kamera/mikrofon yok");
      }
    })();

    const poll = window.setInterval(() => {
      if (stop) return;
      void (async () => {
        try {
          const data = await nearFetch(
            `/api/near/calls?callId=${encodeURIComponent(callId)}&after=${afterIdRef.current}`
          );
          for (const sig of data.signals || []) {
            afterIdRef.current = Math.max(afterIdRef.current, sig.id);
            if (sig.kind === "offer") {
              await pc.setRemoteDescription(
                sig.payload as RTCSessionDescriptionInit
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await nearFetch("/api/near/calls", {
                method: "POST",
                body: JSON.stringify({
                  callId,
                  kind: "answer",
                  payload: answer,
                }),
              });
              setStatus("Cevaplandı");
            } else if (sig.kind === "ice") {
              try {
                await pc.addIceCandidate(sig.payload as RTCIceCandidateInit);
              } catch {
                // ignore
              }
            } else if (sig.kind === "hangup") {
              setStatus("Kapandı");
              await cleanup(false);
            }
          }
        } catch {
          // ignore
        }
      })();
    }, 1000);

    return () => {
      stop = true;
      window.clearInterval(poll);
      void cleanup(true);
    };
  }, [callId, cleanup]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3 text-white">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm">
          {shortAddress(peerWallet)} · {status}
        </p>
        <Button
          size="sm"
          variant="danger"
          onClick={() => void cleanup(true).then(onClose)}
        >
          <PhoneOff className="mr-1 h-4 w-4" />
          Kapat
        </Button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="relative min-h-0 flex-1">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full rounded-xl bg-zinc-900 object-cover"
        />
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-3 right-3 h-36 w-28 rounded-lg object-cover"
        />
      </div>
    </div>
  );
}
