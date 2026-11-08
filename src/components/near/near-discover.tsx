"use client";

import { useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Heart, MapPin, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blindLabel } from "@/lib/near/safety";
import type { NearPeer } from "@/lib/near/types";
import { shortAddress } from "@/lib/starkey";

export function NearDiscover({
  peers,
  unlocked,
  busy,
  onWave,
  onPass,
  onChat,
  onGift,
}: {
  peers: NearPeer[];
  unlocked: (wallet: string) => boolean;
  busy: boolean;
  onWave: (wallet: string) => void;
  onPass: (wallet: string) => void;
  onChat: (wallet: string) => void;
  onGift: (wallet: string, giftId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const deck = useMemo(() => peers, [peers]);
  const peer = deck[index] || null;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const likeOp = useTransform(x, [40, 140], [0, 1]);
  const nopeOp = useTransform(x, [-140, -40], [1, 0]);

  function advance() {
    setIndex((i) => i + 1);
    x.set(0);
  }

  async function swipe(dir: "like" | "nope") {
    if (!peer) return;
    if (dir === "like") onWave(peer.wallet);
    else onPass(peer.wallet);
    advance();
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) void swipe("like");
    else if (info.offset.x < -120) void swipe("nope");
  }

  if (!peer) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center">
        <p className="text-sm text-muted">
          Keşfedilecek kimse kalmadı — check-in yap veya davet paylaş.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => setIndex(0)}
        >
          Başa dön
        </Button>
      </div>
    );
  }

  const open = unlocked(peer.wallet);

  return (
    <section className="mx-auto w-full max-w-sm space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        Keşfet · Tinder × Near
      </p>
      <div className="relative h-[min(62dvh,460px)]">
        <motion.div
          className="absolute inset-0 touch-pan-y overflow-hidden rounded-3xl border border-border bg-surface"
          style={{ x, rotate }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%), linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--background) 92%, black) 100%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-end p-5">
            <motion.span
              style={{ opacity: likeOp }}
              className="absolute left-4 top-6 rounded-lg border-2 border-emerald-400 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-400"
            >
              Selam
            </motion.span>
            <motion.span
              style={{ opacity: nopeOp }}
              className="absolute right-4 top-6 rounded-lg border-2 border-red-400 px-3 py-1 text-sm font-bold uppercase tracking-wide text-red-400"
            >
              Geç
            </motion.span>

            <p className="text-5xl">{open ? peer.avatarEmoji : "◎"}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
              {open ? peer.displayName : blindLabel(peer.wallet)}
            </h2>
            {open && peer.mood ? (
              <p className="mt-1 text-sm text-muted">{peer.mood}</p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Kör kart — Selam ile profil açılır
              </p>
            )}
            {open && peer.bio ? (
              <p className="mt-2 line-clamp-3 text-sm text-foreground/80">
                {peer.bio}
              </p>
            ) : null}
            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted">
              <MapPin className="h-3 w-3" />
              {peer.distanceM != null ? `≈ ${peer.distanceM} m` : "yakın"}
              <span className="ml-2 font-mono opacity-60">
                {shortAddress(peer.wallet)}
              </span>
            </p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          size="lg"
          variant="outline"
          disabled={busy}
          className="h-14 w-14 rounded-full border-danger/40 text-danger"
          onClick={() => void swipe("nope")}
        >
          <X className="h-6 w-6" />
        </Button>
        <Button
          size="lg"
          disabled={busy}
          className="h-14 w-14 rounded-full"
          onClick={() => void swipe("like")}
        >
          <Heart className="h-6 w-6" />
        </Button>
        {open ? (
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-14 rounded-full"
            onClick={() => onChat(peer.wallet)}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            className="h-14 rounded-full px-4 text-xs"
            onClick={() => onGift(peer.wallet, "wave")}
          >
            👋 Wave
          </Button>
        )}
      </div>
      <p className="text-center text-[11px] text-muted">
        Sağa kaydır = Selam · Sola = gizle · {index + 1}/{deck.length || 1}
      </p>
    </section>
  );
}
