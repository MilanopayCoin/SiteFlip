import { Suspense } from "react";
import type { Metadata } from "next";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { filterListings } from "@/lib/marketplace";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Explore",
  description: "Explore digital businesses for sale, rent, and revival.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ExplorePage({ searchParams }: Props) {
  const params = await searchParams;
  const filters: Filters = {
    listingType: (params.type as Filters["listingType"]) || "ALL",
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
          Explore Digital Businesses
        </h1>
        <p className="mt-2 text-zinc-400">
          Buy, rent, or revive — unified marketplace for digital assets.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/explore" />
      </Suspense>

      <p className="mt-6 text-sm text-zinc-500">{listings.length} listings</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
      {listings.length === 0 && (
        <p className="py-16 text-center text-zinc-500">No listings match your filters.</p>
      )}
    </div>
  );
}
