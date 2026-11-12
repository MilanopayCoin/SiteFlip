"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { NearDuel } from "@/lib/near/duels";
import { shortAddress } from "@/lib/starkey";

export function NearDuelResultOverlay({
  duel,
  myWallet,
  onClose,
  onRematch,
}: {
  duel: NearDuel;
  myWallet: string;
  onClose: () => void;
  onRematch?: () => void;
}) {
  const me = myWallet.toLowerCase();
  const won = duel.winnerWallet === me;
  const draw = !duel.winnerWallet;
  const myScore = duel.aWallet === me ? duel.aScore : duel.bScore;
  const theirScore = duel.aWallet === me ? duel.bScore : duel.aScore;
  const rival = duel.aWallet === me ? duel.bWallet : duel.aWallet;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl border border-accent/40 bg-background p-6 text-center shadow-2xl"
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Hediye düellosu
        </p>
        <p className="mt-4 text-5xl" aria-hidden>
          {draw ? "🤝" : won ? "🏆" : "⚡"}
        </p>
        <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {draw ? "Berabere" : won ? "Kazandın" : "Rakip önde"}
        </h2>
        <p className="mt-1 font-mono text-sm text-muted">
          {myScore} — {theirScore} · {shortAddress(rival)}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {onRematch ? (
            <Button className="w-full" onClick={onRematch}>
              Tekrar düello
            </Button>
          ) : null}
          <Button variant="outline" className="w-full" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
