import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceToolbar } from "@/components/marketplace/marketplace-toolbar";
import { MarketplaceFilters } from "@/components/marketplace/filters";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { ListingCard } from "@/components/marketing/listing-card";
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
    <div className="jiy-container py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <SectionHeading
          eyebrow="Exchange"
          title="Marketplace"
          subtitle="Browse digital businesses. Verified badge appears when JIY confirms evidence."
        />
        <div className="flex flex-wrap items-center gap-2">
          {mode === "demo" && <Badge variant="warning">DEMO DATA</Badge>}
          {mode === "supabase" && <Badge variant="success">LIVE</Badge>}
          {error && <Badge variant="warning">SCHEMA PENDING</Badge>}
        </div>
      </div>

      <Suspense fallback={<div className="mb-6 h-12 animate-pulse rounded-[12px] bg-surface-2" />}>
        <MarketplaceToolbar />
      </Suspense>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Suspense
            fallback={<div className="h-80 animate-pulse rounded-[12px] bg-surface-2" />}
          >
            <MarketplaceFilters basePath="/marketplace" layout="rail" omitTypeSort />
          </Suspense>
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <span className="font-mono tabular font-medium text-foreground">
                {total}
              </span>{" "}
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
              className="text-sm font-medium text-accent hover:underline"
            >
              Sell a business
            </Link>
          </div>

          {listings.length === 0 ? (
            <EmptyState
              title="No listings match your filters"
              description="Clear filters or submit a business for review."
              actionHref="/sell"
              actionLabel="Sell a Business"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((l) =>
                l.business ? <ListingCard key={l.id} listing={l} /> : null
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  className="jiy-focus-ring min-h-11 rounded-[12px] border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-2"
                  href={pageHref(page - 1)}
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  className="jiy-focus-ring min-h-11 rounded-[12px] border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-2"
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
