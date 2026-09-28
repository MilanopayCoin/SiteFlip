"use client";

import { useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Submit & verify",
    body: "Listings stay private until JIY reviews ownership and claims.",
  },
  {
    n: "02",
    title: "Offer or pay",
    body: "Buyers offer or pay through Mollie. Status comes from the provider webhook.",
  },
  {
    n: "03",
    title: "Deliver & release",
    body: "Seller delivers, buyer accepts, then payout eligibility opens.",
  },
] as const;

export function HowItWorksSteps() {
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-step"));
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-20% 0px -40% 0px", threshold: 0.2 }
    );

    el.querySelectorAll("[data-step]").forEach((node) => obs.observe(node));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="jiy-section scroll-mt-24">
      <div className="jiy-container">
        <SectionHeading
          eyebrow="Process"
          title="How it works"
          subtitle="Three steps from private listing to protected payout."
        />
        <ol
          ref={ref}
          className="mt-12 flex flex-col gap-6 md:flex-row md:gap-4"
        >
          {STEPS.map((step, idx) => (
            <li
              key={step.n}
              data-step={idx}
              className={cn(
                "flex-1 rounded-[12px] border p-6 transition-colors",
                active === idx
                  ? "border-accent/50 bg-surface-2 shadow-[0_0_32px_var(--glow-accent)]"
                  : "border-border bg-surface"
              )}
            >
              <p className="font-mono text-sm tabular text-accent">{step.n}</p>
              <p className="mt-3 font-display text-xl text-foreground">
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
