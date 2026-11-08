"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getGift } from "@/lib/near/gifts";

export type GiftFxEvent = {
  id: string;
  giftId: string;
  fromLabel?: string;
};

/** TikTok-style full-screen 3D-ish gift burst. */
export function NearGiftFxLayer({
  event,
  onDone,
}: {
  event: GiftFxEvent | null;
  onDone: () => void;
}) {
  const gift = event ? getGift(event.giftId) : null;

  useEffect(() => {
    if (!event) return;
    const t = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(t);
  }, [event, onDone]);

  return (
    <AnimatePresence>
      {event && gift ? (
        <motion.div
          key={event.id}
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <motion.div
            className="relative flex flex-col items-center"
            style={{ perspective: 900 }}
            initial={{ scale: 0.2, rotateY: -40, y: 80 }}
            animate={{
              scale: [0.2, 1.15, 1],
              rotateY: [-40, 12, 0],
              y: [80, -10, 0],
            }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="text-[5.5rem] leading-none drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              style={{ transformStyle: "preserve-3d" }}
              animate={{
                rotateY: [0, 18, -12, 0],
                rotateX: [0, -8, 6, 0],
                scale: [1, 1.08, 1],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              {gift.emoji}
            </motion.div>
            <motion.p
              className="mt-3 text-lg font-semibold tracking-tight text-white"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {gift.label}
              <span className="ml-2 text-sm font-normal text-white/70">
                · {gift.amountSupra} SUPRA
              </span>
            </motion.p>
            {event.fromLabel ? (
              <p className="mt-1 text-xs text-white/55">{event.fromLabel}</p>
            ) : null}
          </motion.div>

          {/* Particle rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute h-40 w-40 rounded-full border border-accent/40"
              initial={{ scale: 0.4, opacity: 0.7 }}
              animate={{ scale: 2.4 + i * 0.35, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 0.15, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function useGiftFx() {
  const [event, setEvent] = useState<GiftFxEvent | null>(null);
  const fire = (giftId: string, fromLabel?: string) => {
    setEvent({ id: `${Date.now()}`, giftId, fromLabel });
  };
  return {
    event,
    fire,
    clear: () => setEvent(null),
  };
}
