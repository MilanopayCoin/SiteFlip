import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListingRow } from "@/components/marketplace/listing-row";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { MarketplaceFilters as Filters } from "@/types/database";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Buy, rent, or revive verified digital businesses.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function MarketplacePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const filters: Filters = {
    listingType: (params.type as Filters["listingType"]) || "ALL",
    category: (params.category as Filters["category"]) || "ALL",
    sort: (params.sort as Filters["sort"]) || "newest",
    search: params.search,
    minAiScore: params.minAiScore ? Number(params.minAiScore) : undefined,
    verifiedOnly: params.verified === "1",
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    minRevenue: params.minRevenue ? Number(params.minRevenue) : undefined,
    minProfit: params.minProfit ? Number(params.minProfit) : undefined,
  };
  const { listings, total, pageSize, mode, error } =
    await fetchMarketplaceListings(filters, { page, pageSize: 24 });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") pageQuery.set(key, value);
  }
  const qs = pageQuery.toString();
  const pageHref = (p: number) =>
    `/marketplace?${qs ? `${qs}&` : ""}page=${p}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="sf-label">Exchange</p>
          <h1 className="font-display mt-1 text-3xl text-zinc-900 sm:text-4xl">
            Marketplace
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Browse verified digital businesses. Seller-claimed figures stay
            unmarked until JIY verifies them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "demo" && <Badge variant="warning">DEMO DATA</Badge>}
          {mode === "supabase" && <Badge variant="success">LIVE</Badge>}
          {error && <Badge variant="warning">SCHEMA PENDING</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Suspense
            fallback={<div className="h-80 animate-pulse bg-zinc-100" />}
          >
            <MarketplaceFilters basePath="/marketplace" layout="rail" />
          </Suspense>
        </aside>

        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-sm text-zinc-500">
              <span className="tabular font-medium text-zinc-900">{total}</span>{" "}
              results
              {totalPages > 1 && (
                <span>
                  {" "}
                  · page {page}/{totalPages}
                </span>
              )}
            </p>
            <Link
              href="/sell"
              className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
            >
              Sell a business
            </Link>
          </div>

          <div className="sf-panel overflow-hidden">
            <div className="hidden border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase sm:grid sm:grid-cols-[minmax(0,1.4fr)_100px_120px_120px_120px_72px] sm:gap-4">
              <span>Business</span>
              <span>Price</span>
              <span>Revenue</span>
              <span>Users</span>
              <span />
              <span className="text-right"> </span>
            </div>
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} />
            ))}
            {listings.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No listings match your filters"
                  description="Clear filters or submit a business for review."
                  actionHref="/sell"
                  actionLabel="Sell a Business"
                />
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  className="border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  href={pageHref(page - 1)}
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  className="border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  href={pageHref(page + 1)}
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
