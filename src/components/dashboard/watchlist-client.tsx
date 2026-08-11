"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BusinessCard } from "@/components/marketplace/business-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Listing } from "@/types/database";

type WatchItem = {
  id: string;
  listing_id: string;
  listing?: Listing | null;
};

export function WatchlistClient() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function remove(listingId: string) {
    await fetch(`/api/watchlist?listingId=${encodeURIComponent(listingId)}`, {
      method: "DELETE",
    });
    await load();
  }

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Watchlist</h1>
      <p className="mt-1 text-sm text-zinc-400">Saved listings</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {items.length === 0 ? (
        <EmptyState
          title="Watchlist is empty"
          description="Save listings from the marketplace to track them here."
          actionHref="/explore"
          actionLabel="Browse marketplace"
        />
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) =>
            item.listing?.business ? (
              <div key={item.id} className="space-y-2">
                <BusinessCard listing={item.listing} index={i} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => remove(item.listing_id)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 p-4 text-sm text-zinc-400"
              >
                Listing {item.listing_id}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => remove(item.listing_id)}
                >
                  Remove
                </Button>
              </div>
            )
          )}
        </div>
      )}

      <Button className="mt-6" variant="secondary" asChild>
        <Link href="/explore">Browse more</Link>
      </Button>
    </div>
  );
}
