import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMarketplaceStats } from "@/lib/marketplace/stats";

export default async function HomePage() {
  const stats = await fetchMarketplaceStats();

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="sf-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              JIY
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
              Verified Digital Businesses.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-zinc-500 sm:text-lg">
              Buy. Rent. Revive. Sell.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="xl" asChild>
                <Link href="/marketplace">
                  Explore Marketplace <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/sell">Sell a Business</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Active Listings"
              value={stats.activeListings}
            />
            <Stat
              label="Verified Businesses"
              value={stats.verifiedBusinesses}
            />
            <Stat
              label="Completed Deals"
              value={stats.completedDeals}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-6 text-center">
      <p className="text-3xl font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  );
}
