import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingRow } from "@/components/marketplace/listing-row";
import { fetchMarketplaceStats } from "@/lib/marketplace/stats";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stats = {
    activeListings: 0,
    verifiedBusinesses: 0,
    completedDeals: 0,
  };
  let listings: Awaited<
    ReturnType<typeof fetchMarketplaceListings>
  >["listings"] = [];

  try {
    stats = await fetchMarketplaceStats();
  } catch {
    // keep zeros
  }

  try {
    const market = await fetchMarketplaceListings(
      { sort: "newest" },
      { page: 1, pageSize: 3 }
    );
    listings = (market.listings || []).filter((l) => Boolean(l?.business));
  } catch {
    listings = [];
  }

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="sf-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <p className="sf-label mb-5">JIY</p>
          <h1 className="font-display text-4xl leading-tight text-zinc-900 sm:text-6xl">
            Verified Digital Businesses.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base text-zinc-500 sm:text-lg">
            Buy. Rent. Revive. Sell.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="rounded-md" asChild>
              <Link href="/marketplace">
                Explore Marketplace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-md" asChild>
              <Link href="/sell">Sell a Business</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-zinc-200">
          <Stat label="Active listings" value={stats.activeListings} />
          <Stat label="Verified" value={stats.verifiedBusinesses} />
          <Stat label="Completed deals" value={stats.completedDeals} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="sf-label">How deals work</p>
        <ol className="mt-6 space-y-5">
          {[
            {
              n: "01",
              t: "Submit & verify",
              d: "Listings stay private until JIY reviews ownership and claims.",
            },
            {
              n: "02",
              t: "Offer or pay",
              d: "Buyers offer or pay through Mollie. Status comes from the provider webhook.",
            },
            {
              n: "03",
              t: "Deliver & release",
              d: "Seller delivers, buyer accepts, then payout eligibility opens.",
            },
          ].map((step) => (
            <li
              key={step.n}
              className="grid grid-cols-[48px_1fr] gap-4 border-b border-zinc-200 pb-5"
            >
              <span className="tabular text-sm text-zinc-400">{step.n}</span>
              <div>
                <p className="font-medium text-zinc-900">{step.t}</p>
                <p className="mt-1 text-sm text-zinc-500">{step.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {listings.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="sf-label">On the exchange</p>
              <h2 className="font-display mt-1 text-2xl text-zinc-900">
                Recent listings
              </h2>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="sf-panel overflow-hidden">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-8 text-center sm:px-6">
      <p className="tabular text-2xl font-semibold text-zinc-900 sm:text-3xl">
        {Number.isFinite(value) ? value : 0}
      </p>
      <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{label}</p>
    </div>
  );
}
