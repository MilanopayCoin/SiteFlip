import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[12px] border border-accent/35 bg-accent/10 font-mono font-semibold uppercase tracking-wider text-accent",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <ShieldCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Verified
    </span>
  );
}
