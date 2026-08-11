import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Rent",
  description: "Rent digital businesses or rent-to-own with configurable purchase credit.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RentPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const filters: Filters = {
    listingType: "RENT",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "ai",
    search: params.search,
    verifiedOnly: params.verified === "1",
  };
  const { listings, total, mode } = await fetchMarketplaceListings(filters, {
    page,
    pageSize: 24,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Rent Digital Businesses
          </h1>
          {mode === "demo" && <Badge variant="warning">DEMO DATA</Badge>}
        </div>
        <p className="mt-2 max-w-2xl text-zinc-400">
          A business does not always need to be purchased. Operate cash-flowing assets
          monthly — or use rent-to-own where part of payments can count toward purchase.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link href="/rent">Rent</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/explore?type=RENT_TO_OWN">Rent to Own</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/buy">Buy instead</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Rent-to-own uses a flexible contract architecture. SITEFLIP does not create
          automatically legally binding ownership-transfer contracts.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/rent" />
      </Suspense>

      <p className="mt-6 text-sm text-zinc-500">{total} listings</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
      {listings.length === 0 && (
        <EmptyState
          title="No rental listings"
          description="List a business for rent from your dashboard."
          actionHref="/dashboard/listings/new"
          actionLabel="Create rental listing"
        />
      )}
    </div>
  );
}
