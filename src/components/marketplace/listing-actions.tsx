"use client";

import { useState } from "react";
import type { Listing } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ListingActions({ listing }: { listing: Listing }) {
  const [showOffer, setShowOffer] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRent = ["RENT", "RENT_TO_OWN"].includes(listing.listing_type);
  const isRevive = listing.listing_type === "REVIVE";

  async function submitOffer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: Number(fd.get("amount")),
          message: fd.get("message"),
          currency: listing.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Offer failed");
      setStatus("Offer submitted (PENDING). Demo mode — not persisted to production DB.");
      setShowOffer(false);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function addWatchlist() {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id }),
    });
    setStatus("Added to watchlist (demo).");
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg">
        {isRevive ? "Revive This Business" : isRent ? "Start Rental" : "Buy Now"}
      </Button>
      <Button
        className="w-full"
        variant="secondary"
        onClick={() => setShowOffer(!showOffer)}
      >
        Make Offer
      </Button>
      {!isRevive && listing.rental_price_monthly && !isRent && (
        <Button className="w-full" variant="outline">
          Rent · {listing.currency === "EUR" ? "€" : ""}
          {listing.rental_price_monthly}/mo
        </Button>
      )}
      <Button className="w-full" variant="ghost" onClick={addWatchlist}>
        Add to Watchlist
      </Button>

      {showOffer && (
        <form onSubmit={submitOffer} className="space-y-2 rounded-xl border border-white/10 p-3">
          <Input
            name="amount"
            type="number"
            required
            placeholder="Offer amount"
            defaultValue={listing.price ?? listing.rental_price_monthly ?? undefined}
          />
          <Textarea name="message" placeholder="Message to seller (optional)" />
          <Button type="submit" disabled={loading} className="w-full" size="sm">
            {loading ? "Sending…" : "Submit offer"}
          </Button>
        </form>
      )}

      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </div>
  );
}
