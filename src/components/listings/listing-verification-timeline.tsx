import { cn } from "@/lib/utils";
import {
  laneState,
  type VerificationLane,
} from "@/lib/marketplace/verification";
import type { BusinessVerification } from "@/types/database";

const LANES: { lane: VerificationLane; label: string }[] = [
  { lane: "OWNERSHIP", label: "Ownership" },
  { lane: "REVENUE", label: "Revenue" },
  { lane: "ANALYTICS", label: "Analytics" },
  { lane: "DOMAIN", label: "Domain" },
  { lane: "CODE_ASSETS", label: "Code" },
  { lane: "IDENTITY", label: "Identity" },
];

export function ListingVerificationTimeline({
  verifications,
}: {
  verifications: BusinessVerification[];
}) {
  const verifiedCount = LANES.filter(
    ({ lane }) => laneState(lane, verifications) === "VERIFIED"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="sf-label">Verification lanes</span>
        <span className="font-mono tabular text-muted">
          {verifiedCount}/{LANES.length} verified
        </span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2" aria-label="Verification status">
        {LANES.map(({ lane, label }, i) => {
          const state = laneState(lane, verifications);
          const verified = state === "VERIFIED";
          const failed = state === "FAILED";
          return (
            <li
              key={lane}
              className={cn(
                "flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-sm",
                verified
                  ? "border-accent/30 bg-accent/5"
                  : failed
                    ? "border-danger/40 bg-danger/5"
                    : "border-border bg-surface"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] tabular",
                  verified
                    ? "bg-accent text-accent-foreground"
                    : failed
                      ? "bg-danger/20 text-danger"
                      : "bg-surface-2 text-muted"
                )}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{label}</p>
                <p
                  className={cn(
                    "text-[11px] uppercase tracking-wide",
                    verified
                      ? "text-accent"
                      : failed
                        ? "text-danger"
                        : "text-muted"
                  )}
                >
                  {state}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
