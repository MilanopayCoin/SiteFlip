import { Suspense } from "react";
import type { Metadata } from "next";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { filterListings } from "@/lib/marketplace";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Revive",
  description: "Find forgotten digital businesses and revive them with AI.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RevivePage({ searchParams }: Props) {
  const params = await searchParams;
  const filters: Filters = {
    listingType: "REVIVE",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "ai",
    search: params.search,
  };
  const listings = filterListings(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Find forgotten digital businesses.
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Abandoned SaaS, failed startups, dead websites, unused domains, and side
          projects — each with an AI Revival Score. Verified data, seller claims, and
          AI assumptions are always labeled separately.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/revive" />
      </Suspense>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
    </div>
  );
}
