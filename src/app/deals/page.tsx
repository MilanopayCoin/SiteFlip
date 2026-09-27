import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchMarketplaceStats } from "@/lib/marketplace/stats";

export const metadata: Metadata = {
  title: "Deals",
  description: "Completed marketplace deals on JIY.APP.",
};

export default async function DealsPage() {
  const stats = await fetchMarketplaceStats();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Deals</h1>
      <p className="mt-3 text-zinc-500">
        Completed marketplace transactions. Numbers are real — never fabricated.
      </p>
      <div className="mt-10 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center">
        <p className="text-4xl font-semibold tabular-nums text-zinc-900">
          {stats.completedDeals}
        </p>
        <p className="mt-2 text-sm text-zinc-500">Completed deals</p>
        {stats.completedDeals === 0 && (
          <p className="mt-4 text-sm text-zinc-400">
            No completed deals yet. Browse the marketplace to find a business.
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/marketplace">Explore Marketplace</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/sell">Sell a Business</Link>
        </Button>
      </div>
    </div>
  );
}
