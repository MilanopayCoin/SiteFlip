"use client";

import Link from "next/link";
import type { Listing } from "@/types/database";
import { formatCurrency, formatNumber, CATEGORY_LABELS } from "@/lib/utils";
import { isJiyVerified } from "@/lib/marketplace/verification";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function typeTag(listing: Listing): string {
  if (listing.listing_type === "REVIVE") return "REVIVE";
  if (listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN")
    return "RENT";
  return "BUY";
}

export function ListingCard({
  listing,
  desaturated,
  className,
}: {
  listing: Listing;
  desaturated?: boolean;
  className?: string;
}) {
  const b = listing.business;
  if (!b) return null;

  const verified = isJiyVerified(listing.verifications);
  const price =
    listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
      ? listing.rental_price_monthly
      : listing.price;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn("listing-card-3d block h-full", className)}
    >
      <article
        className={cn(
          "jiy-glow-hover flex h-full flex-col rounded-[12px] border border-border bg-surface p-5 transition-[filter,opacity]",
          desaturated &&
            "opacity-75 grayscale hover:grayscale-0 hover:opacity-100"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{typeTag(listing)}</Badge>
          {verified ? (
            <VerifiedBadge size="sm" />
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Unverified
            </span>
          )}
        </div>
        <h3 className="mt-4 font-display text-xl tracking-tight text-foreground">
          {listing.title || b.name}
        </h3>
        <p className="mt-2 font-mono text-2xl tabular text-foreground">
          {formatCurrency(price, listing.currency)}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-xs">
          <div>
            <dt className="text-muted">MRR</dt>
            <dd className="font-mono tabular text-foreground">
              {formatCurrency(b.monthly_revenue, listing.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Users</dt>
            <dd className="font-mono tabular text-foreground">
              {formatNumber(b.monthly_traffic)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Age</dt>
            <dd className="font-mono tabular text-foreground">
              {b.domain_age_years != null ? `${b.domain_age_years}y` : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          {CATEGORY_LABELS[b.category] ?? b.category}
        </p>
      </article>
    </Link>
  );
}
