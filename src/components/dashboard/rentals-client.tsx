"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

type Rental = {
  id: string;
  listing_id: string;
  monthly_price: number;
  minimum_months: number | null;
  is_rent_to_own: boolean;
  credit_percent: number | null;
  purchase_price: number | null;
  status: string;
  requester_id: string;
  owner_id: string;
  message: string | null;
};

export function RentalsClient() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/rentals");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRentals(data.rentals ?? []);
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

  async function updateStatus(
    rentalId: string,
    status: "ACCEPTED" | "REJECTED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  ) {
    setBusy(rentalId);
    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Rentals</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Rental requests and rent-to-own — not escrow, not automatic legal contracts.
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {rentals.length === 0 ? (
        <EmptyState
          title="No rentals yet"
          description="Request a rental from any RENT listing on the marketplace."
          actionHref="/rent"
          actionLabel="Browse rentals"
        />
      ) : (
        <div className="mt-6 space-y-3">
          {rentals.map((r) => {
            const remaining =
              r.is_rent_to_own &&
              r.purchase_price &&
              r.credit_percent &&
              r.minimum_months
                ? Math.max(
                    0,
                    r.purchase_price -
                      r.monthly_price *
                        r.minimum_months *
                        (r.credit_percent / 100)
                  )
                : null;

            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {formatCurrency(r.monthly_price)}/mo
                        {r.is_rent_to_own ? " · Rent to own" : ""}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Listing {r.listing_id.slice(0, 12)}…
                        {r.minimum_months
                          ? ` · min ${r.minimum_months} mo`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="info">{r.status}</Badge>
                  </div>
                  {remaining != null && (
                    <p className="text-xs text-zinc-500">
                      Estimated remaining balance after term:{" "}
                      {formatCurrency(remaining)} (estimate only)
                    </p>
                  )}
                  {r.status === "REQUESTED" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() => updateStatus(r.id, "ACCEPTED")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === r.id}
                        onClick={() => updateStatus(r.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === r.id}
                        onClick={() => updateStatus(r.id, "CANCELLED")}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {r.status === "ACCEPTED" && (
                    <Button
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => updateStatus(r.id, "ACTIVE")}
                    >
                      Mark active
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
