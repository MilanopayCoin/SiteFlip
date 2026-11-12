"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { getGift } from "@/lib/near/gifts";

export type GiftFxEvent = {
  id: string;
  giftId: string;
  fromLabel?: string;
};

const MEGA = new Set(["rocket", "universe", "crown", "spotlight"]);

/** TikTok-style full-screen 3D-ish gift burst. */
export function NearGiftFxLayer({
  event,
  onDone,
}: {
  event: GiftFxEvent | null;
  onDone: () => void;
}) {
  const gift = event ? getGift(event.giftId) : null;
  const mega = event ? MEGA.has(event.giftId) : false;

  useEffect(() => {
    if (!event) return;
    const t = window.setTimeout(onDone, mega ? 3800 : 2800);
    return () => window.clearTimeout(t);
  }, [event, onDone, mega]);

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
          <div
            className={`absolute inset-0 backdrop-blur-[2px] ${
              mega ? "bg-black/50" : "bg-black/35"
            }`}
          />
          {mega ? (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={`spark-${i}`}
                  className="absolute text-3xl"
                  style={{
                    left: `${12 + i * 18}%`,
                    top: `${18 + (i % 3) * 22}%`,
                  }}
                  initial={{ opacity: 0, y: 40, scale: 0.4 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: [40, -30, -80],
                    scale: [0.4, 1.2, 0.8],
                  }}
                  transition={{ duration: 2.2, delay: i * 0.12 }}
                >
                  {gift.emoji}
                </motion.span>
              ))}
            </>
          ) : null}
          <motion.div
            className="relative flex flex-col items-center"
            style={{ perspective: 900 }}
            initial={{ scale: 0.2, rotateY: -40, y: 80 }}
            animate={{
              scale: mega ? [0.15, 1.35, 1.05] : [0.2, 1.15, 1],
              rotateY: [-40, 12, 0],
              y: [80, -10, 0],
            }}
            transition={{ duration: mega ? 1.05 : 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className={`${
                mega ? "text-[7rem]" : "text-[5.5rem]"
              } leading-none drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]`}
              style={{ transformStyle: "preserve-3d" }}
              animate={{
                rotateY: [0, 18, -12, 0],
                rotateX: [0, -8, 6, 0],
                scale: mega ? [1, 1.14, 1] : [1, 1.08, 1],
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
            {mega ? (
              <motion.p
                className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                Mega show
              </motion.p>
            ) : null}
          </motion.div>

          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full border ${
                mega
                  ? "h-52 w-52 border-accent/55"
                  : "h-40 w-40 border-accent/40"
              }`}
              initial={{ scale: 0.4, opacity: 0.7 }}
              animate={{ scale: (mega ? 2.8 : 2.4) + i * 0.35, opacity: 0 }}
              transition={{ duration: mega ? 1.7 : 1.4, delay: i * 0.15, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function useGiftFx() {
  const [event, setEvent] = useState<GiftFxEvent | null>(null);
  const fire = useCallback((giftId: string, fromLabel?: string) => {
    setEvent({ id: `${Date.now()}-${giftId}`, giftId, fromLabel });
  }, []);
  const clear = useCallback(() => setEvent(null), []);
  return { event, fire, clear };
}
