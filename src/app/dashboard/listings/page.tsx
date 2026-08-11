import Link from "next/link";
import { getEnrichedListings } from "@/lib/data/demo";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "My Listings" };

export default function MyListingsPage() {
  const listings = getEnrichedListings().filter((l) => l.seller_id === "seller-1");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">My Listings</h1>
        <Button asChild><Link href="/sell">New listing</Link></Button>
      </div>
      <div className="mt-6 space-y-3">
        {listings.map((l) => (
          <Card key={l.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-white">{l.title}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="outline">{l.listing_type}</Badge>
                  <Badge variant="success">{l.status}</Badge>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-white">{formatCurrency(l.price ?? l.rental_price_monthly)}</p>
                <p className="text-zinc-500">{l.views} views</p>
              </div>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/listings/${l.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
