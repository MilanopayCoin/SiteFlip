import type { MarketplaceFilters, Listing } from "@/types/database";
import { getEnrichedListings } from "@/lib/data/demo";

export function filterListings(
  filters: MarketplaceFilters = {},
  listings: Listing[] = getEnrichedListings()
): Listing[] {
  let results = listings.filter((l) => l.status === "ACTIVE");

  if (filters.listingType && filters.listingType !== "ALL") {
    if (filters.listingType === "BUY") {
      results = results.filter((l) =>
        ["BUY", "SELL"].includes(l.listing_type)
      );
    } else if (filters.listingType === "RENT") {
      results = results.filter((l) =>
        ["RENT", "RENT_TO_OWN"].includes(l.listing_type)
      );
    } else {
      results = results.filter((l) => l.listing_type === filters.listingType);
    }
  }

  if (filters.category && filters.category !== "ALL") {
    results = results.filter((l) => l.business?.category === filters.category);
  }

  if (filters.minPrice != null) {
    results = results.filter(
      (l) => (l.price ?? l.rental_price_monthly ?? 0) >= filters.minPrice!
    );
  }
  if (filters.maxPrice != null) {
    results = results.filter(
      (l) => (l.price ?? Infinity) <= filters.maxPrice!
    );
  }
  if (filters.minRevenue != null) {
    results = results.filter(
      (l) => (l.business?.monthly_revenue ?? 0) >= filters.minRevenue!
    );
  }
  if (filters.maxRevenue != null) {
    results = results.filter(
      (l) => (l.business?.monthly_revenue ?? 0) <= filters.maxRevenue!
    );
  }
  if (filters.minProfit != null) {
    results = results.filter(
      (l) => (l.business?.monthly_profit ?? 0) >= filters.minProfit!
    );
  }
  if (filters.minTraffic != null) {
    results = results.filter(
      (l) => (l.business?.monthly_traffic ?? 0) >= filters.minTraffic!
    );
  }
  if (filters.minAiScore != null) {
    results = results.filter(
      (l) => (l.business?.ai_score ?? 0) >= filters.minAiScore!
    );
  }
  if (filters.maxRisk != null) {
    results = results.filter(
      (l) => (l.business?.risk_score ?? 100) <= filters.maxRisk!
    );
  }
  if (filters.verifiedOnly) {
    results = results.filter(
      (l) => (l.verifications?.length ?? 0) > 0
    );
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.summary?.toLowerCase().includes(q) ||
        l.business?.name.toLowerCase().includes(q) ||
        l.business?.category.includes(q)
    );
  }

  const sort = filters.sort ?? "ai";
  results = [...results].sort((a, b) => {
    switch (sort) {
      case "price":
        return (a.price ?? 0) - (b.price ?? 0);
      case "revenue":
        return (b.business?.monthly_revenue ?? 0) - (a.business?.monthly_revenue ?? 0);
      case "growth":
        return (b.business?.growth_rate ?? 0) - (a.business?.growth_rate ?? 0);
      case "newest":
        return (
          new Date(b.published_at ?? b.created_at).getTime() -
          new Date(a.published_at ?? a.created_at).getTime()
        );
      case "ai":
      default:
        return (b.business?.ai_score ?? 0) - (a.business?.ai_score ?? 0);
    }
  });

  return results;
}
