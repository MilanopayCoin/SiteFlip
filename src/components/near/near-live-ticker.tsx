"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { NearGiftInboxItem, NearHotZone } from "@/lib/near/types";
import { shortAddress } from "@/lib/starkey";

export type LiveTickerItem = {
  id: string;
  emoji: string;
  text: string;
  tone?: "gift" | "zone" | "wave";
};

export function buildLiveTicker(input: {
  inbox: NearGiftInboxItem[];
  hotZones: NearHotZone[];
  pendingWaves: number;
}): LiveTickerItem[] {
  const items: LiveTickerItem[] = [];
  if (input.pendingWaves > 0) {
    items.push({
      id: "waves",
      emoji: "👋",
      text: `${input.pendingWaves} yeni Selam bekliyor`,
      tone: "wave",
    });
  }
  for (const g of input.inbox.slice(0, 4)) {
    items.push({
      id: `gift-${g.id}`,
      emoji: g.giftEmoji || "🎁",
      text: `${g.fromName || shortAddress(g.fromWallet)} · ${g.giftLabel}`,
      tone: "gift",
    });
  }
  for (const z of input.hotZones.filter((h) => !h.mine).slice(0, 3)) {
    items.push({
      id: `zone-${z.geohash}`,
      emoji: "📡",
      text: `${z.geohash} · ${z.count} kişi canlı`,
      tone: "zone",
    });
  }
  return items;
}

/** TikTok-style rotating live strip. */
export function NearLiveTicker({
  items,
  onTapWave,
}: {
  items: LiveTickerItem[];
  onTapWave?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const safe = useMemo(() => items.filter(Boolean), [items]);

  useEffect(() => {
    setIdx(0);
  }, [safe.length]);

  useEffect(() => {
    if (safe.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % safe.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [safe.length]);

  if (safe.length === 0) return null;
  const cur = safe[idx % safe.length]!;

  return (
    <button
      type="button"
      onClick={() => {
        if (cur.tone === "wave") onTapWave?.();
      }}
      className="relative flex w-full items-center gap-2 overflow-hidden rounded-xl border border-border/80 bg-surface/70 px-3 py-2 text-left"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        Live
      </span>
      <div className="relative min-h-[1.25rem] flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={cur.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="truncate text-[12px] text-foreground/90"
          >
            <span className="mr-1.5">{cur.emoji}</span>
            {cur.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </button>
  );
}
