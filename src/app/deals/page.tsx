"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Deals</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your buy and sell transactions. Open a deal room to track payment,
        delivery, and disputes.
      </p>

      {loading && (
        <div className="mt-8 h-40 animate-pulse rounded-xl bg-zinc-100" />
      )}

      {error && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <p className="mt-8 text-sm text-zinc-500">
          No deals yet.{" "}
          <Link href="/marketplace" className="underline">
            Browse the marketplace
          </Link>
          .
        </p>
      )}

      {!loading && deals.length > 0 && (
        <ul className="mt-8 divide-y divide-zinc-200 border-t border-zinc-200">
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
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">{title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {d.type} · {role} · {d.status}
                      {d.funds_state ? ` · ${d.funds_state}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-zinc-700">
                    {formatCurrency(d.amount, d.currency)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
