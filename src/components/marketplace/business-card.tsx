"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Listing } from "@/types/database";
import { formatCurrency, formatNumber, CATEGORY_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isJiyVerified } from "@/lib/marketplace/verification";

export function BusinessCard({ listing }: { listing: Listing; index?: number }) {
  const b = listing.business;
  if (!b) return null;

  const typeLabel =
    listing.listing_type === "REVIVE"
      ? "REVIVE"
      : listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
        ? "RENT"
        : "BUY";

  const price =
    typeLabel === "RENT"
      ? listing.rental_price_monthly
      : listing.price;

  const verified = isJiyVerified(listing.verifications);
  const revenueVerified = (listing.verifications || []).some(
    (v) => v.type === "REVENUE" && v.status === "VERIFIED"
  );
  const usersVerified = (listing.verifications || []).some(
    (v) =>
      (v.type === "TRAFFIC" || v.type === "ANALYTICS") &&
      v.status === "VERIFIED"
  );

  return (
    <article className="flex flex-col border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{typeLabel}</Badge>
        {(b.is_demo || listing.is_demo) && (
          <Badge variant="warning">DEMO</Badge>
        )}
        {verified && (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            JIY VERIFIED
          </Badge>
        )}
      </div>

      <h3 className="mt-3 text-lg font-semibold text-zinc-900">{b.name}</h3>
      <p className="mt-0.5 text-sm text-zinc-500">
        {CATEGORY_LABELS[b.category] ?? b.category}
      </p>

      <p className="mt-4 text-2xl font-semibold tabular-nums text-zinc-900">
        {formatCurrency(price, listing.currency)}
        {typeLabel === "RENT" && (
          <span className="text-sm font-normal text-zinc-500">/mo</span>
        )}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-400">
            Revenue
          </dt>
          <dd className="mt-0.5 text-zinc-800">
            {revenueVerified
              ? `${formatCurrency(b.monthly_revenue)}/mo`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-400">
            Users
          </dt>
          <dd className="mt-0.5 text-zinc-800">
            {usersVerified ? formatNumber(b.monthly_traffic) : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <Button size="sm" className="w-full" asChild>
          <Link href={`/listings/${listing.id}`}>View</Link>
        </Button>
      </div>
    </article>
  );
}
