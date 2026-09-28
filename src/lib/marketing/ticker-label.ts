import type { Listing } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { isJiyVerified } from "@/lib/marketplace/verification";
import { CATEGORY_LABELS } from "@/lib/utils";

export function listingTickerLabel(listing: Listing): string {
  const category =
    CATEGORY_LABELS[listing.business?.category ?? ""]?.toUpperCase() ?? "BUSINESS";
  const price = formatCurrency(
    listing.price ?? listing.rental_price_monthly,
    listing.currency || "EUR"
  );
  const verified = isJiyVerified(listing.verifications) ? "VERIFIED" : "LISTED";
  const title = (listing.business?.name || listing.title).slice(0, 32);
  return `${category} · ${title} · ${price} · ${verified}`;
}

export const TICKER_FALLBACK_ITEMS = [
  "OWNERSHIP VERIFIED",
  "MOLLIE PROTECTED",
  "BUY",
  "RENT",
  "REVIVE",
  "SELL",
] as const;
