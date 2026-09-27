import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Listing } from "@/types/database";
import { formatCurrency, formatNumber, CATEGORY_LABELS } from "@/lib/utils";
import { isJiyVerified } from "@/lib/marketplace/verification";

export function ListingRow({ listing }: { listing: Listing }) {
  const b = listing.business;
  if (!b) return null;

  const typeLabel =
    listing.listing_type === "REVIVE"
      ? "REVIVE"
      : listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
        ? "RENT"
        : "BUY";

  const price =
    typeLabel === "RENT" ? listing.rental_price_monthly : listing.price;

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
    <Link
      href={`/listings/${listing.id}`}
      className="group grid grid-cols-1 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-4 transition-colors hover:bg-zinc-50 sm:grid-cols-[minmax(0,1.4fr)_100px_120px_120px_120px_72px] sm:gap-4 sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sf-label">{typeLabel}</span>
          {(b.is_demo || listing.is_demo) && (
            <span className="sf-label text-amber-700">DEMO</span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
              <ShieldCheck className="h-3 w-3" />
              JIY VERIFIED
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-base font-medium text-zinc-900 group-hover:underline">
          {b.name}
        </p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">
          {CATEGORY_LABELS[b.category] ?? b.category}
        </p>
      </div>

      <div className="hidden sm:block">
        <p className="sf-label">Price</p>
        <p className="mt-0.5 tabular text-sm font-medium text-zinc-900">
          {formatCurrency(price, listing.currency)}
          {typeLabel === "RENT" && (
            <span className="font-normal text-zinc-400">/mo</span>
          )}
        </p>
      </div>

      <div className="hidden sm:block">
        <p className="sf-label">Revenue</p>
        <p className="mt-0.5 tabular text-sm text-zinc-900">
          {revenueVerified ? `${formatCurrency(b.monthly_revenue)}/mo` : "—"}
        </p>
        <p
          className={
            revenueVerified ? "sf-claim-verified" : "sf-claim-unverified"
          }
        >
          {revenueVerified ? "Verified" : "Unverified"}
        </p>
      </div>

      <div className="hidden sm:block">
        <p className="sf-label">Users</p>
        <p className="mt-0.5 tabular text-sm text-zinc-900">
          {usersVerified ? formatNumber(b.monthly_traffic) : "—"}
        </p>
        <p
          className={usersVerified ? "sf-claim-verified" : "sf-claim-unverified"}
        >
          {usersVerified ? "Verified" : "Unverified"}
        </p>
      </div>

      <div className="flex items-center justify-between sm:hidden">
        <div>
          <p className="sf-label">Price</p>
          <p className="tabular text-sm font-medium text-zinc-900">
            {formatCurrency(price, listing.currency)}
            {typeLabel === "RENT" && "/mo"}
          </p>
        </div>
        <span className="text-sm font-medium text-zinc-900 underline-offset-2 group-hover:underline">
          View
        </span>
      </div>

      <div className="hidden justify-end sm:flex">
        <span className="text-sm font-medium text-zinc-900 underline-offset-4 group-hover:underline">
          View
        </span>
      </div>
    </Link>
  );
}
