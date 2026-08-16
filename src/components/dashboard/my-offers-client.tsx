"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Offer = {
  id: string;
  listing_id: string;
  amount: number;
  currency: string;
  status: string;
  message: string | null;
  buyer_id: string;
  seller_id: string;
};

export function MyOffersClient() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counterId, setCounterId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/offers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOffers(data.offers ?? []);
      setUserId(data.userId ?? "");
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

  async function act(
    offerId: string,
    action: "ACCEPT" | "REJECT" | "COUNTER" | "CANCEL",
    amount?: number
  ) {
    setBusy(offerId);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, action, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCounterId(null);
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
      <h1 className="text-2xl font-semibold text-white">My Offers</h1>
      <p className="mt-1 text-sm text-zinc-400">
        PENDING · COUNTERED · ACCEPTED · REJECTED · EXPIRED · CANCELLED
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {offers.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="Browse the marketplace and make an offer on a listing you like."
          actionHref="/explore"
          actionLabel="Explore marketplace"
        />
      ) : (
        <div className="mt-6 space-y-3">
          {offers.map((o) => {
            const isSeller = o.seller_id === userId;
            const isBuyer = o.buyer_id === userId;
            const open = ["PENDING", "COUNTERED"].includes(o.status);

            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        €{Number(o.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isSeller ? "Incoming" : "Outgoing"} · Listing{" "}
                        {o.listing_id.slice(0, 12)}…
                        {o.message ? ` · ${o.message}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        o.status === "ACCEPTED"
                          ? "success"
                          : o.status === "PENDING"
                            ? "warning"
                            : "info"
                      }
                    >
                      {o.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSeller && open && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy === o.id}
                          onClick={() => act(o.id, "ACCEPT")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === o.id}
                          onClick={() => act(o.id, "REJECT")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === o.id}
                          onClick={() => {
                            setCounterId(o.id);
                            setCounterAmount(String(o.amount));
                          }}
                        >
                          Counter
                        </Button>
                      </>
                    )}
                    {isBuyer && o.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === o.id}
                        onClick={() => act(o.id, "CANCEL")}
                      >
                        Cancel
                      </Button>
                    )}
                    {isBuyer && o.status === "COUNTERED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy === o.id}
                          onClick={() => act(o.id, "ACCEPT")}
                        >
                          Accept counter
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCounterId(o.id);
                            setCounterAmount(String(o.amount));
                          }}
                        >
                          Counter back
                        </Button>
                      </>
                    )}
                  </div>
                  {counterId === o.id && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={counterAmount}
                        onChange={(e) => setCounterAmount(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={busy === o.id}
                        onClick={() =>
                          act(o.id, "COUNTER", Number(counterAmount))
                        }
                      >
                        Send counter
                      </Button>
                    </div>
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
