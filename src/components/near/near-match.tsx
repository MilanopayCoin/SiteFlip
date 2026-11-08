"use client";

import { motion } from "framer-motion";
import { MessageCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NearPeer } from "@/lib/near/types";

export function NearMatchOverlay({
  peer,
  onChat,
  onVideo,
  onClose,
}: {
  peer: NearPeer;
  onChat: () => void;
  onVideo: () => void;
  onClose: () => void;
}) {
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
          It&apos;s a match
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-5xl">✨</span>
          <span className="text-4xl text-accent">×</span>
          <span className="text-5xl">{peer.avatarEmoji}</span>
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          {peer.displayName}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Karşılıklı Selam — chat ve görüntülü açıldı
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button className="w-full" onClick={onChat}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Sohbete git
          </Button>
          <Button variant="outline" className="w-full" onClick={onVideo}>
            <Video className="mr-2 h-4 w-4" />
            Görüntülü ara
          </Button>
          <button
            type="button"
            className="mt-1 text-xs text-muted hover:text-foreground"
            onClick={onClose}
          >
            Keşfete devam
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
