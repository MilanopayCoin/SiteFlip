"use client";

import { useState } from "react";
import type { Listing } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

export function ListingActions({ listing }: { listing: Listing }) {
  const [panel, setPanel] = useState<"none" | "offer" | "message" | "rent">(
    "none"
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRent = ["RENT", "RENT_TO_OWN"].includes(listing.listing_type);
  const isRevive = listing.listing_type === "REVIVE";
  const isBuy = ["BUY", "SELL"].includes(listing.listing_type);
  const canRent =
    isRent || (!!listing.rental_price_monthly && !isRevive);

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
      setStatus(
        data.mode === "demo"
          ? "Offer submitted (PENDING). DEMO mode — connect Supabase to persist."
          : "Offer submitted (PENDING)."
      );
      setPanel("none");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: listing.seller_id,
          listingId: listing.id,
          businessId: listing.business_id,
          body: String(fd.get("body") || ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Message failed");
      setStatus("Message sent. View inbox in Dashboard → Messages.");
      setPanel("none");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitRent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          message: fd.get("message"),
          minMonths: fd.get("minMonths")
            ? Number(fd.get("minMonths"))
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rent request failed");
      setStatus(
        data.notice ||
          "Rental request submitted (REQUESTED). Not a binding contract or escrow."
      );
      setPanel("none");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function addWatchlist() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setStatus(
        data.mode === "demo"
          ? "Saved to watchlist (DEMO)."
          : "Saved to watchlist."
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {isBuy && (
        <Button
          className="w-full"
          size="lg"
          onClick={() => setPanel(panel === "offer" ? "none" : "offer")}
        >
          Buy Now / Make Offer
        </Button>
      )}
      {isRevive && (
        <Button
          className="w-full"
          size="lg"
          onClick={() => setPanel(panel === "offer" ? "none" : "offer")}
        >
          Revive — Make Offer
        </Button>
      )}
      {isRent && (
        <Button
          className="w-full"
          size="lg"
          onClick={() => setPanel(panel === "rent" ? "none" : "rent")}
        >
          Rent
        </Button>
      )}
      {!isRent && (
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => setPanel(panel === "offer" ? "none" : "offer")}
        >
          Make Offer
        </Button>
      )}
      {canRent && !isRent && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setPanel(panel === "rent" ? "none" : "rent")}
        >
          Rent · {formatCurrency(listing.rental_price_monthly, listing.currency)}
          /mo
        </Button>
      )}
      <Button
        className="w-full"
        variant="outline"
        onClick={() => setPanel(panel === "message" ? "none" : "message")}
      >
        Message Seller
      </Button>
      <Button
        className="w-full"
        variant="ghost"
        disabled={loading}
        onClick={addWatchlist}
      >
        Save to Watchlist
      </Button>

      {panel === "offer" && (
        <form
          onSubmit={submitOffer}
          className="space-y-2 rounded-xl border border-white/10 p-3"
        >
          <Input
            name="amount"
            type="number"
            required
            min={1}
            placeholder="Offer amount"
            defaultValue={
              listing.price ?? listing.rental_price_monthly ?? undefined
            }
          />
          <Textarea name="message" placeholder="Message to seller (optional)" />
          <Button type="submit" disabled={loading} className="w-full" size="sm">
            {loading ? "Sending…" : "Submit offer"}
          </Button>
        </form>
      )}

      {panel === "message" && (
        <form
          onSubmit={submitMessage}
          className="space-y-2 rounded-xl border border-white/10 p-3"
        >
          <Textarea
            name="body"
            required
            placeholder="Write a message about this listing…"
          />
          <Button type="submit" disabled={loading} className="w-full" size="sm">
            {loading ? "Sending…" : "Send message"}
          </Button>
        </form>
      )}

      {panel === "rent" && (
        <form
          onSubmit={submitRent}
          className="space-y-2 rounded-xl border border-white/10 p-3"
        >
          <p className="text-xs text-zinc-500">
            Monthly:{" "}
            {formatCurrency(listing.rental_price_monthly, listing.currency)}
            {listing.listing_type === "RENT_TO_OWN" &&
              listing.rent_to_own_credit_percent != null && (
                <>
                  {" "}
                  · Rent-to-own credit {listing.rent_to_own_credit_percent}%
                  (estimate only)
                </>
              )}
          </p>
          <Input
            name="minMonths"
            type="number"
            min={1}
            placeholder="Minimum months"
            defaultValue={listing.rent_to_own_period_months ?? 3}
          />
          <Textarea name="message" placeholder="Message to owner (optional)" />
          <Button type="submit" disabled={loading} className="w-full" size="sm">
            {loading ? "Submitting…" : "Request rental"}
          </Button>
          <p className="text-[10px] text-zinc-600">
            Not escrow. Not a legally binding contract. Creates a rental request
            only.
          </p>
        </form>
      )}

      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </div>
  );
}
