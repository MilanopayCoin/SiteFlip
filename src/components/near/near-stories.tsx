"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blindLabel } from "@/lib/near/safety";
import type { NearPeer } from "@/lib/near/types";
import { shortAddress } from "@/lib/starkey";

export type StoryPeer = NearPeer & { pendingWave?: boolean };

/** Instagram/Tinder-style proximity status rings. */
export function NearStoriesStrip({
  peers,
  unlocked,
  myEmoji,
  myMood,
  onOpenSelf,
  onWave,
  onChat,
  onDuel,
}: {
  peers: StoryPeer[];
  unlocked: (wallet: string) => boolean;
  myEmoji: string;
  myMood: string;
  onOpenSelf: () => void;
  onWave: (wallet: string) => void;
  onChat: (wallet: string) => void;
  onDuel: (wallet: string) => void;
}) {
  const [active, setActive] = useState<StoryPeer | null>(null);
  const deck = useMemo(
    () =>
      peers
        .filter((p) => Boolean(p.mood?.trim()) || unlocked(p.wallet) || p.pendingWave)
        .slice(0, 12),
    [peers, unlocked]
  );

  if (deck.length === 0 && !myMood) return null;

  return (
    <>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Stories · şu an yakında
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={onOpenSelf}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${
                myMood
                  ? "border-accent bg-accent/10"
                  : "border-dashed border-border bg-surface/60"
              }`}
            >
              {myEmoji || "✨"}
            </span>
            <span className="w-full truncate text-center text-[10px] text-muted">
              Senin
            </span>
          </button>
          {deck.map((p) => {
            const open = unlocked(p.wallet);
            return (
              <button
                key={p.wallet}
                type="button"
                onClick={() => setActive(p)}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${
                    p.pendingWave
                      ? "border-accent bg-accent/15 shadow-[0_0_16px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
                      : open
                        ? "border-accent/70 bg-surface"
                        : "border-border bg-surface/70"
                  }`}
                >
                  {open ? p.avatarEmoji : "◎"}
                </span>
                <span className="w-full truncate text-center text-[10px] text-muted">
                  {open ? p.displayName.slice(0, 8) : blindLabel(p.wallet).slice(0, 8)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {active ? (
          <motion.div
            className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 px-4 pb-10 backdrop-blur-sm sm:items-center sm:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative px-5 pb-5 pt-8"
                style={{
                  background:
                    "radial-gradient(ellipse 90% 70% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 65%)",
                }}
              >
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full border border-border/80 p-1.5 text-muted hover:text-foreground"
                  onClick={() => setActive(null)}
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-center text-5xl">
                  {unlocked(active.wallet) ? active.avatarEmoji : "◎"}
                </p>
                <h3 className="mt-3 text-center font-display text-xl font-semibold tracking-tight">
                  {unlocked(active.wallet)
                    ? active.displayName
                    : blindLabel(active.wallet)}
                </h3>
                <p className="mt-1 text-center text-sm text-muted">
                  {active.mood?.trim() || "Yakında · status yok"}
                </p>
                {unlocked(active.wallet) && active.bio ? (
                  <p className="mt-2 line-clamp-3 text-center text-sm text-foreground/80">
                    {active.bio}
                  </p>
                ) : null}
                <p className="mt-3 text-center font-mono text-[10px] text-muted">
                  {active.distanceM != null
                    ? `≈ ${active.distanceM} m`
                    : "yakın"}{" "}
                  · {shortAddress(active.wallet)}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {unlocked(active.wallet) ? (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => {
                          const w = active.wallet;
                          setActive(null);
                          onChat(w);
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Sohbet
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const w = active.wallet;
                          setActive(null);
                          onDuel(w);
                        }}
                      >
                        <Swords className="mr-2 h-4 w-4" />
                        Hediye düellosu
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => {
                        const w = active.wallet;
                        setActive(null);
                        onWave(w);
                      }}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      {active.pendingWave ? "Selam dön" : "Selam at"}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
