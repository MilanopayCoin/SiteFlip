"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

const MODES = [
  {
    key: "buy",
    title: "Buy",
    body: "Acquire verified revenue assets with protected checkout.",
    href: "/marketplace?type=BUY",
  },
  {
    key: "rent",
    title: "Rent",
    body: "Operate a business monthly before you commit to full ownership.",
    href: "/marketplace?type=RENT",
  },
  {
    key: "revive",
    title: "Revive",
    body: "Only on JIY — resurrect abandoned projects with verified handover.",
    href: "/marketplace?type=REVIVE",
    featured: true,
  },
  {
    key: "sell",
    title: "Sell",
    body: "List privately until ownership checks complete, then go live.",
    href: "/sell",
  },
] as const;

export function ModesBento() {
  const reduce = useReducedMotion();

  return (
    <section className="jiy-section">
      <div className="jiy-container">
        <SectionHeading
          eyebrow="Modes"
          title="Buy. Rent. Revive. Sell."
          subtitle="One exchange — four ways to move digital businesses."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-3">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.key}
              className={cn(
                "h-full min-h-[140px]",
                mode.key === "revive" &&
                  "md:col-span-2 md:row-span-3 md:col-start-2 md:row-start-1 md:min-h-[320px]",
                mode.key === "buy" && "md:col-start-1 md:row-start-1",
                mode.key === "rent" && "md:col-start-1 md:row-start-2",
                mode.key === "sell" && "md:col-start-1 md:row-start-3"
              )}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <Link
                href={mode.href}
                className={cn(
                  "jiy-glow-hover flex h-full flex-col justify-end rounded-[12px] border border-border bg-surface p-6 transition-transform",
                  "featured" in mode &&
                    mode.featured &&
                    "border-accent/30 bg-surface-2"
                )}
              >
                {"featured" in mode && mode.featured && (
                  <span className="sf-label mb-auto text-accent">
                    Only on JIY
                  </span>
                )}
                <h3 className="font-display text-2xl text-foreground">
                  {mode.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{mode.body}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
