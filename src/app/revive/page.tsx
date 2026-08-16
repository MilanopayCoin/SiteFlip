import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessCard } from "@/components/marketplace/business-card";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Revive",
  description: "Find forgotten digital businesses and revive them with AI.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RevivePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const filters: Filters = {
    listingType: "REVIVE",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "ai",
    search: params.search,
  };
  const { listings, total, mode } = await fetchMarketplaceListings(filters, {
    page,
    pageSize: 24,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Find forgotten digital businesses.
              </h1>
              {mode === "demo" && <Badge variant="warning">DEMO DATA</Badge>}
            </div>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Abandoned SaaS, failed startups, dead websites, unused domains, and side
              projects — each with an AI Revival Score. Verified data, seller claims, and
              AI assumptions are always labeled separately.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/revive/new">Submit project</Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5" />}>
        <MarketplaceFilters basePath="/revive" />
      </Suspense>

      <p className="mt-6 text-sm text-zinc-500">{total} listings</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
      {listings.length === 0 && (
        <EmptyState
          title="No revive projects"
          description="Submit an abandoned project to get an AI revival analysis."
          actionHref="/dashboard/revive/new"
          actionLabel="Submit revive project"
        />
      )}
    </div>
  );
}
