"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { DealLifecycleTimeline } from "@/components/deals/deal-lifecycle-timeline";
import { Badge } from "@/components/ui/badge";

/* robots: noindex — private deal list (metadata via layout if needed) */

type Deal = {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  funds_state?: string | null;
  buyer_id: string;
  seller_id: string;
  listing?: { title?: string; id?: string } | null;
  business?: { name?: string; slug?: string } | null;
  updated_at?: string;
  created_at?: string;
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/deals");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load deals");
        if (!cancelled) {
          setDeals(data.deals ?? []);
          setUserId(data.userId ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="jiy-container max-w-3xl py-8 sm:py-10">
      <SectionHeading
        eyebrow="Workspace"
        title="Deals"
        subtitle="Open a deal room for payment, delivery, acceptance, and disputes."
      />

      {loading && (
        <div className="mt-8 h-40 animate-pulse rounded-[12px] bg-surface-2" />
      )}

      {error && (
        <p className="mt-6 rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error === "Authentication required" ? (
            <>
              <Link href="/login?next=/deals" className="underline">
                Sign in
              </Link>{" "}
              to view your deals.
            </>
          ) : (
            error
          )}
        </p>
      )}

      {!loading && !error && deals.length === 0 && (
        <p className="mt-8 text-sm text-muted">
          No deals yet.{" "}
          <Link href="/marketplace" className="underline">
            Browse the marketplace
          </Link>
          .
        </p>
      )}

      {!loading && deals.length > 0 && (
        <ul className="mt-8 space-y-3">
          {deals.map((d) => {
            const role =
              d.buyer_id === userId
                ? "Buyer"
                : d.seller_id === userId
                  ? "Seller"
                  : "Party";
            const title =
              d.listing?.title || d.business?.name || `Deal ${d.id.slice(0, 8)}`;
            return (
              <li key={d.id}>
                <Link
                  href={`/deals/${d.id}`}
                  className="jiy-focus-ring block rounded-[12px] border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{d.type}</Badge>
                        <Badge variant="outline">{role}</Badge>
                        <Badge variant="outline">{d.status}</Badge>
                      </div>
                      <div className="mt-4">
                        <DealLifecycleTimeline
                          status={d.status}
                          fundsState={d.funds_state}
                          compact
                        />
                      </div>
                    </div>
                    <p className="shrink-0 font-mono text-sm tabular text-foreground">
                      {formatCurrency(d.amount, d.currency)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
