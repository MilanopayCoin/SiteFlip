import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Explore",
  description: "Explore digital businesses for sale, rent, and revival.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ExplorePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const filters: Filters = {
    listingType: (params.type as Filters["listingType"]) || "ALL",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "ai",
    search: params.search,
    minAiScore: params.minAiScore ? Number(params.minAiScore) : undefined,
    verifiedOnly: params.verified === "1",
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    minRevenue: params.minRevenue ? Number(params.minRevenue) : undefined,
    minProfit: params.minProfit ? Number(params.minProfit) : undefined,
  };
  const { listings, total, pageSize, mode, error } = await fetchMarketplaceListings(
    filters,
    { page, pageSize: 24 }
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Explore Digital Businesses
          </h1>
          {mode === "demo" && <Badge variant="warning">DEMO DATA</Badge>}
          {mode === "supabase" && <Badge variant="success">LIVE</Badge>}
          {error && <Badge variant="warning">SCHEMA PENDING</Badge>}
        </div>
        <p className="mt-2 text-zinc-400">
          Buy, rent, or revive — unified marketplace for digital assets.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/explore" />
      </Suspense>

      <p className="mt-6 text-sm text-zinc-500">
        {total} listings · page {page}/{totalPages}
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
      {listings.length === 0 && (
        <EmptyState
          title="No listings match your filters"
          description="Try clearing filters or create your own listing."
          actionHref="/dashboard/listings/new"
          actionLabel="Create listing"
        />
      )}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <Link
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300"
              href={`/explore?page=${page - 1}`}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300"
              href={`/explore?page=${page + 1}`}
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
