"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarqueeProps = {
  children: ReactNode;
  className?: string;
  /** Animation duration in seconds */
  duration?: number;
  ariaLabel?: string;
};

export function Marquee({
  children,
  className,
  duration = 40,
  ariaLabel = "Scrolling announcements",
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-border bg-surface",
        className
      )}
      aria-label={ariaLabel}
    >
      <div
        className="jiy-marquee-track flex w-max"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

export function MarqueeItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center px-6 py-3 font-mono text-xs uppercase tracking-widest text-muted sm:text-sm",
        className
      )}
    >
      {children}
      <span className="mx-6 text-border" aria-hidden>
        ·
      </span>
    </span>
  );
}
