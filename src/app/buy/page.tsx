import { Suspense } from "react";
import type { Metadata } from "next";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { filterListings } from "@/lib/marketplace";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Buy",
  description: "Purchase complete digital businesses — SaaS, ecommerce, newsletters, and more.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function BuyPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters: Filters = {
    listingType: "BUY",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "ai",
    search: params.search,
    minAiScore: params.minAiScore ? Number(params.minAiScore) : undefined,
    verifiedOnly: params.verified === "1",
  };
  const listings = filterListings(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Buy Digital Businesses
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Acquire complete digital assets — SaaS, AI tools, ecommerce, newsletters,
          extensions, and more. Every card shows revenue, profit, traffic, and AI Score.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/buy" />
      </Suspense>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
    </div>
  );
}
