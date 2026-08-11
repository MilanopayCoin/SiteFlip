import Link from "next/link";
import { getEnrichedListings } from "@/lib/data/demo";
import { BusinessCard } from "@/components/marketplace/business-card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  const items = getEnrichedListings().slice(0, 3);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Watchlist</h1>
      <p className="mt-1 text-sm text-zinc-400">Saved listings — demo seed.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l, i) => (
          <BusinessCard key={l.id} listing={l} index={i} />
        ))}
      </div>
      <Button className="mt-6" variant="secondary" asChild>
        <Link href="/explore">Browse more</Link>
      </Button>
    </div>
  );
}
