"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";

const TYPE_PILLS = [
  { value: "ALL", label: "All" },
  { value: "BUY", label: "Buy" },
  { value: "RENT", label: "Rent" },
  { value: "REVIVE", label: "Revive" },
] as const;

const SORT_PILLS = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "revenue", label: "Revenue" },
  { value: "ai", label: "AI score" },
] as const;

export function MarketplaceToolbar({ basePath = "/marketplace" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "ALL") next.delete(key);
      else next.set(key, value);
      next.delete("page");
      startTransition(() => {
        router.push(`${basePath}?${next.toString()}`);
      });
    },
    [params, router, basePath]
  );

  const activeType = params.get("type") ?? "ALL";
  const activeSort = params.get("sort") ?? "newest";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        pending && "opacity-70"
      )}
    >
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Listing type"
      >
        {TYPE_PILLS.map((t) => {
          const active = activeType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update("type", t.value)}
              className={cn(
                "jiy-focus-ring min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-surface text-muted hover:border-accent/30 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="sf-label shrink-0">Sort</span>
        {SORT_PILLS.map((s) => {
          const active = activeSort === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => update("sort", s.value)}
              className={cn(
                "jiy-focus-ring min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-border bg-surface-2 text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
