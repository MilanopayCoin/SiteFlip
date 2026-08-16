import type { Listing } from "@/types/database";

/** Flat listing summary for API responses (avoids circular refs). */
export function toListingSummary(listing: Listing) {
  const b = listing.business;
  return {
    id: listing.id,
    title: listing.title,
    summary: listing.summary,
    price: listing.price,
    rental_price_monthly: listing.rental_price_monthly,
    listing_type: listing.listing_type,
    currency: listing.currency,
    featured: listing.featured,
    business: b
      ? {
          id: b.id,
          slug: b.slug,
          name: b.name,
          tagline: b.tagline,
          category: b.category,
          monthly_revenue: b.monthly_revenue,
          monthly_profit: b.monthly_profit,
          monthly_traffic: b.monthly_traffic,
          growth_rate: b.growth_rate,
          ai_score: b.ai_score,
          health_score: b.health_score,
          risk_score: b.risk_score,
        }
      : null,
    seller: listing.seller
      ? {
          id: listing.seller.id,
          full_name: listing.seller.full_name,
          seller_score: listing.seller.seller_score,
          is_verified: listing.seller.is_verified,
        }
      : null,
    verification_count: listing.verifications?.length ?? 0,
  };
}
