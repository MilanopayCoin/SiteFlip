"use client";

import { motion, useReducedMotion } from "framer-motion";
import { VerifiedBadge } from "@/components/ui/verified-badge";

export function HeroVerificationScene() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className="relative flex h-full min-h-[280px] items-center justify-center rounded-[12px] border border-border bg-surface p-6">
        <div className="w-full max-w-xs space-y-3">
          <div className="rounded-[12px] border border-border bg-surface-2 p-4">
            <p className="sf-label">Listing</p>
            <p className="mt-2 font-display text-lg text-foreground">
              Sample listing card
            </p>
            <p className="mt-1 font-mono text-sm tabular text-muted">€ — · SaaS</p>
          </div>
          <VerifiedBadge />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[280px] items-center justify-center overflow-hidden rounded-[12px] border border-border bg-surface p-6">
      <motion.div
        className="relative w-full max-w-xs rounded-[12px] border border-border bg-surface-2 p-4"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <p className="sf-label">Listing</p>
        <p className="mt-2 font-display text-lg text-foreground">
          Ownership review
        </p>
        <p className="mt-1 font-mono text-sm tabular text-muted">€ — · SaaS</p>

        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-accent shadow-[0_0_12px_var(--glow-accent-hover)]"
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{ delay: 0.5, duration: 0.55, ease: "linear" }}
          aria-hidden
        />
      </motion.div>

      <motion.div
        className="absolute bottom-8 right-8 rotate-[-8deg]"
        initial={{ opacity: 0, scale: 1.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.15, duration: 0.35, type: "spring", stiffness: 260 }}
      >
        <VerifiedBadge />
      </motion.div>
    </div>
  );
}
