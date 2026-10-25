"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LAYER_STYLES,
  SYMBOLS,
  layerForReel,
} from "@/lib/games/chrono-forge/symbols";
import type { Grid, SymbolId } from "@/lib/games/chrono-forge/types";
import { REEL_COUNT, ROW_COUNT } from "@/lib/games/chrono-forge/types";
import { cn } from "@/lib/utils";

type Props = {
  grid: Grid;
  spinning: boolean;
  fusion: boolean;
  timeShift: boolean;
  highlightSymbols?: SymbolId[];
};

export function ReelGrid({
  grid,
  spinning,
  fusion,
  timeShift,
  highlightSymbols = [],
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-amber-900/50 bg-gradient-to-b from-[#1a1208] via-[#0f0a06] to-[#050403] p-3 shadow-[0_0_40px_rgba(212,175,55,0.15)]",
        timeShift && "ring-2 ring-violet-500/60",
        fusion && "ring-2 ring-amber-400/80"
      )}
    >
      {(timeShift || fusion) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-amber-500/10 via-transparent to-violet-500/10"
        />
      )}
      <div className="mb-2 flex justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">
        <span>Geçmiş</span>
        <span className="text-teal-300/80">Şimdi</span>
        <span>Gelecek</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: REEL_COUNT }).map((_, reelIdx) => {
          const layer = layerForReel(reelIdx);
          const style = LAYER_STYLES[layer];
          return (
            <div
              key={reelIdx}
              className={cn(
                "rounded-xl border p-1 sm:p-1.5",
                style.border,
                style.bg,
                style.glow
              )}
            >
              <AnimatePresence mode="popLayout">
                {Array.from({ length: ROW_COUNT }).map((__, rowIdx) => {
                  const sym = grid[reelIdx]?.[rowIdx] ?? "gear";
                  const def = SYMBOLS[sym];
                  const hot = highlightSymbols.includes(sym);
                  return (
                    <motion.div
                      key={`${reelIdx}-${rowIdx}-${sym}-${spinning}`}
                      initial={spinning ? { y: -24, opacity: 0.3 } : false}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: spinning ? reelIdx * 0.07 + rowIdx * 0.03 : 0,
                        type: "spring",
                        stiffness: 380,
                        damping: 28,
                      }}
                      className={cn(
                        "mb-1 flex aspect-square items-center justify-center rounded-lg border border-white/5 bg-black/40 text-xl sm:text-2xl last:mb-0",
                        hot && "border-accent/60 bg-accent/10 shadow-[0_0_12px_var(--glow-accent)]",
                        sym === "wild" && "bg-amber-500/20",
                        sym === "scatter" && "bg-violet-500/20"
                      )}
                      title={def.label}
                    >
                      <span className="select-none">{def.emoji}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      {fusion && (
        <p className="mt-2 text-center text-xs font-medium text-amber-300">
          Zaman birleşti — 243 yol modu (demo)
        </p>
      )}
    </div>
  );
}
