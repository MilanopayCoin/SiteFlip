"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ListingRow = {
  id: string;
  title: string;
  status: string;
  listing_type: string;
  price?: number | null;
  seller_id: string;
  created_at?: string;
};

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/listings?mine=0&pageSize=100");
      const data = await res.json();
      // Public ACTIVE only — also load pending via admin-aware path if present
      const pendingRes = await fetch("/api/admin/listings/pending").catch(
        () => null
      );
      let pending: ListingRow[] = [];
      if (pendingRes?.ok) {
        const p = await pendingRes.json();
        pending = p.listings ?? [];
      }
      const active = (data.listings ?? []) as ListingRow[];
      const byId = new Map<string, ListingRow>();
      for (const l of [...pending, ...active]) byId.set(l.id, l);
      setListings([...byId.values()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function moderate(
    id: string,
    action: "VERIFY_LIVE" | "REJECT" | "SUSPEND"
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Moderation failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Admin · Listings</h1>
      <p className="mt-1 text-sm text-muted">
        VERIFY_LIVE publishes a PENDING listing. REJECT / SUSPEND keep it off
        the marketplace.
      </p>

      {loading && (
        <div className="mt-8 h-32 animate-pulse rounded-[12px] bg-surface-2" />
      )}
      {error && (
        <p className="mt-6 rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="mt-8 divide-y divide-border border-t border-border">
        {listings.map((l) => (
          <li
            key={l.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-foreground">{l.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {l.listing_type} · {l.id.slice(0, 8)}
              </p>
              <Badge variant="outline" className="mt-2">
                {l.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyId === l.id || l.status === "ACTIVE"}
                onClick={() => void moderate(l.id, "VERIFY_LIVE")}
              >
                Verify → Live
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === l.id}
                onClick={() => void moderate(l.id, "REJECT")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === l.id}
                onClick={() => void moderate(l.id, "SUSPEND")}
              >
                Suspend
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {!loading && listings.length === 0 && (
        <p className="mt-8 text-sm text-muted">No listings loaded.</p>
      )}
    </div>
  );
}
