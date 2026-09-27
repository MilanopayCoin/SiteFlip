"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "ALL", label: "All" },
  { value: "BUY", label: "Buy" },
  { value: "RENT", label: "Rent" },
  { value: "REVIVE", label: "Revive" },
];

const SORTS = [
  { value: "ai", label: "AI Recommended" },
  { value: "price", label: "Price" },
  { value: "revenue", label: "Revenue" },
  { value: "growth", label: "Growth" },
  { value: "newest", label: "Newest" },
];

const CATEGORIES = [
  "ALL",
  "saas",
  "ai_tools",
  "ecommerce",
  "shopify",
  "affiliate",
  "blog",
  "newsletter",
  "chrome_extensions",
  "web_apps",
  "digital_products",
  "abandoned_saas",
  "failed_startup",
  "unused_domain",
];

export function MarketplaceFilters({ basePath = "/marketplace" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "ALL") next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.push(`${basePath}?${next.toString()}`);
      });
    },
    [params, router, basePath]
  );

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search businesses…"
          className="pl-9"
          defaultValue={params.get("search") ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            const t = setTimeout(() => update("search", v), 300);
            return () => clearTimeout(t);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => update("type", t.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              (params.get("type") ?? "ALL") === t.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="mb-1.5 block text-xs text-zinc-500">Category</Label>
          <select
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
            value={params.get("category") ?? "ALL"}
            onChange={(e) => update("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All categories" : c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-zinc-500">Sort</Label>
          <select
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
            value={params.get("sort") ?? "ai"}
            onChange={(e) => update("sort", e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-zinc-500">Min AI Score</Label>
          <Input
            type="number"
            placeholder="e.g. 70"
            defaultValue={params.get("minAiScore") ?? ""}
            onBlur={(e) => update("minAiScore", e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              className="rounded border-zinc-300 bg-white"
              checked={params.get("verified") === "1"}
              onChange={(e) => update("verified", e.target.checked ? "1" : "")}
            />
            Verified only
          </label>
        </div>
      </div>
    </div>
  );
}
