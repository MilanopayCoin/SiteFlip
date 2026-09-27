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
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "revenue", label: "Revenue" },
  { value: "ai", label: "AI score" },
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

export function MarketplaceFilters({
  basePath = "/marketplace",
  layout = "rail",
}: {
  basePath?: string;
  layout?: "rail" | "stack";
}) {
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

  const shell =
    layout === "rail"
      ? "space-y-6 sf-panel p-5"
      : "space-y-4";

  return (
    <div className={cn(shell, pending && "opacity-70")}>
      <div>
        <p className="sf-label mb-3">Search</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Name, category…"
            className="rounded-md border-zinc-200 pl-9"
            defaultValue={params.get("search") ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              window.clearTimeout((window as unknown as { __jiySearch?: number }).__jiySearch);
              (window as unknown as { __jiySearch?: number }).__jiySearch =
                window.setTimeout(() => update("search", v), 300);
            }}
          />
        </div>
      </div>

      <div>
        <p className="sf-label mb-3">Type</p>
        <div className="flex flex-col gap-1">
          {TYPES.map((t) => {
            const active = (params.get("type") ?? "ALL") === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update("type", t.value)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="sf-label mb-2 block">Category</Label>
        <select
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="sf-label mb-2 block">Min price</Label>
          <Input
            type="number"
            placeholder="0"
            className="rounded-md"
            defaultValue={params.get("minPrice") ?? ""}
            onBlur={(e) => update("minPrice", e.target.value)}
          />
        </div>
        <div>
          <Label className="sf-label mb-2 block">Max price</Label>
          <Input
            type="number"
            placeholder="∞"
            className="rounded-md"
            defaultValue={params.get("maxPrice") ?? ""}
            onBlur={(e) => update("maxPrice", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="sf-label mb-2 block">Min revenue / mo</Label>
        <Input
          type="number"
          placeholder="Any"
          className="rounded-md"
          defaultValue={params.get("minRevenue") ?? ""}
          onBlur={(e) => update("minRevenue", e.target.value)}
        />
      </div>

      <div>
        <Label className="sf-label mb-2 block">Sort</Label>
        <select
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          value={params.get("sort") ?? "newest"}
          onChange={(e) => update("sort", e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="rounded border-zinc-300"
          checked={params.get("verified") === "1"}
          onChange={(e) => update("verified", e.target.checked ? "1" : "")}
        />
        Verified only
      </label>
    </div>
  );
}
