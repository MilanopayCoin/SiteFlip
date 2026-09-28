import type { Listing } from "@/types/database";

/** Real listings only — no DEMO seed rows on the marketing homepage. */
export function isRealPublishedListing(listing: Listing): boolean {
  if (listing.status !== "ACTIVE") return false;
  if (listing.is_demo) return false;
  if (!listing.business || listing.business.is_demo) return false;
  return true;
}

export function filterRealListings(listings: Listing[]): Listing[] {
  return listings.filter(isRealPublishedListing);
}
