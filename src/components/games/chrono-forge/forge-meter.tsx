"use client";

import { Progress } from "@/components/ui/progress";
import { forgeTierFromMeter } from "@/lib/games/chrono-forge/engine";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  className?: string;
};

const TIER_MARKS = [
  { at: 33, label: "Bronz" },
  { at: 66, label: "Gümüş" },
  { at: 100, label: "Altın Forge" },
];

export function ForgeMeter({ value, className }: Props) {
  const tier = forgeTierFromMeter(value);
  const tierLabel =
    tier === "gold"
      ? "Altın — Forge Bonus hazır"
      : tier === "silver"
        ? "Gümüş demir"
        : tier === "bronze"
          ? "Bronz kıvılcım"
          : "Soğuk örs";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Forge Metre
          </p>
          <p className="text-sm font-semibold text-foreground">{tierLabel}</p>
        </div>
        <span className="font-mono text-sm text-accent">{Math.min(100, Math.round(value))}%</span>
      </div>
      <div className="relative">
        <Progress value={Math.min(100, value)} className="h-3 bg-surface-2" />
        <div className="pointer-events-none absolute inset-0 flex justify-between px-0.5">
          {TIER_MARKS.map((m) => (
            <div
              key={m.at}
              className="h-full w-px bg-foreground/20"
              style={{ marginLeft: m.at === 33 ? "33%" : m.at === 66 ? "33%" : "auto", width: 0 }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted">
        {TIER_MARKS.map((m) => (
          <span key={m.label}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}
