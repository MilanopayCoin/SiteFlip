"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Listing = {
  id: string;
  title: string;
  listing_type: string;
  status: string;
  price: number | null;
  rental_price_monthly: number | null;
  views?: number;
  is_demo?: boolean;
};

export function MyListingsClient() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/listings?mine=1")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setListings(d.listings ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  if (error) {
    return (
      <EmptyState title="Couldn’t load listings" description={error} />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">My Listings</h1>
        <Button asChild>
          <Link href="/dashboard/listings/new">New listing</Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Create a business, then publish a BUY, RENT, or REVIVE listing."
          actionHref="/dashboard/listings/new"
          actionLabel="Create listing"
        />
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-white">{l.title}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline">{l.listing_type}</Badge>
                    <Badge
                      variant={l.status === "ACTIVE" ? "success" : "warning"}
                    >
                      {l.status}
                    </Badge>
                    {l.is_demo && <Badge variant="warning">DEMO</Badge>}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-white">
                    {formatCurrency(l.price ?? l.rental_price_monthly)}
                  </p>
                  <p className="text-zinc-500">{l.views ?? 0} views</p>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/listings/${l.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
