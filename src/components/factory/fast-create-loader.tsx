"use client";

import { motion } from "framer-motion";

const STAGES = ["Idea", "Generate", "Build", "Preview"] as const;

/**
 * Lightweight CSS/Framer “3D” creator animation for mobile + desktop.
 * No Three.js — stays Free-Worker and battery friendly.
 */
export function FastCreateLoader({
  label = "Fast Create",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07060c]/92 px-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Creating your app"
    >
      <div className="relative w-full max-w-sm text-center">
        <div
          className="mx-auto mb-10 h-44 w-44"
          style={{ perspective: "720px" }}
        >
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: 360, rotateX: [12, -8, 12] }}
            transition={{
              rotateY: { duration: 7.5, ease: "linear", repeat: Infinity },
              rotateX: { duration: 4.2, ease: "easeInOut", repeat: Infinity },
            }}
          >
            {[0, 1, 2, 3].map((face) => (
              <div
                key={face}
                className="absolute inset-4 rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent shadow-[0_0_40px_rgba(139,92,246,0.25)]"
                style={{
                  transform: `rotateY(${face * 90}deg) translateZ(72px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                <div className="flex h-full flex-col items-center justify-center gap-1 p-3">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-violet-200/80">
                    JIY
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {STAGES[face]}
                  </span>
                </div>
              </div>
            ))}
            <motion.div
              className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300"
              animate={{ scale: [1, 1.6, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ transform: "translateZ(8px)" }}
            />
          </motion.div>
        </div>

        <motion.p
          className="text-lg font-semibold text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {label}
        </motion.p>
        <motion.p
          className="mt-2 text-sm text-zinc-400"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          Spinning up a preview-ready app — usually under a minute.
          Keep this screen open.
        </motion.p>

        <div className="mt-6 flex justify-center gap-2">
          {STAGES.map((s, i) => (
            <motion.span
              key={s}
              className="h-1.5 w-8 rounded-full bg-violet-500/40"
              animate={{
                backgroundColor: [
                  "rgba(139,92,246,0.35)",
                  "rgba(167,139,250,0.95)",
                  "rgba(139,92,246,0.35)",
                ],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: i * 0.28,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
