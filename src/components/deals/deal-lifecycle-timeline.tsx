import { cn } from "@/lib/utils";

const STEPS = [
  { key: "verify", label: "Verify" },
  { key: "pay", label: "Pay" },
  { key: "deliver", label: "Deliver" },
  { key: "release", label: "Release" },
] as const;

function stepIndex(status: string, fundsState?: string | null): number {
  if (status === "COMPLETED" || fundsState === "ACCEPTED") return 3;
  if (
    fundsState === "DELIVERED" ||
    status === "TRANSFER_PENDING" ||
    status === "INSPECTION"
  )
    return 2;
  if (
    status === "PAYMENT_RECEIVED" ||
    fundsState === "PAYMENT_RECEIVED" ||
    status === "PAYMENT_PENDING" ||
    fundsState === "PAYMENT_PENDING"
  )
    return 1;
  return 0;
}

export function DealLifecycleTimeline({
  status,
  fundsState,
  compact,
}: {
  status: string;
  fundsState?: string | null;
  compact?: boolean;
}) {
  const active = stepIndex(status, fundsState);

  return (
    <ol
      className={cn(
        "flex w-full items-center justify-between gap-1",
        compact ? "text-[10px]" : "text-xs"
      )}
      aria-label="Deal progress"
    >
      {STEPS.map((step, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-2 w-full max-w-[4rem] rounded-full",
                done || current ? "bg-accent" : "bg-border"
              )}
              aria-hidden
            />
            <span
              className={cn(
                "font-medium uppercase tracking-wide",
                current ? "text-accent" : done ? "text-foreground" : "text-muted"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
