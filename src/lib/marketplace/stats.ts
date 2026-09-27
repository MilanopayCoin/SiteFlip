import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export type MarketplaceStats = {
  activeListings: number;
  verifiedBusinesses: number;
  completedDeals: number;
  mode: "supabase" | "unavailable";
};

/**
 * Real marketplace stats only. Never fabricate numbers.
 * Returns zeros when DB unavailable or empty.
 */
export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  await ensureCloudflareEnv().catch(() => undefined);
  if (!isSupabaseConfigured()) {
    return {
      activeListings: 0,
      verifiedBusinesses: 0,
      completedDeals: 0,
      mode: "unavailable",
    };
  }

  const supabase =
    (await createServiceClient()) || (await createClient());
  if (!supabase) {
    return {
      activeListings: 0,
      verifiedBusinesses: 0,
      completedDeals: 0,
      mode: "unavailable",
    };
  }

  const [listings, verified, deals] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")
      .eq("is_demo", false),
    supabase
      .from("business_verifications")
      .select("business_id", { count: "exact", head: true })
      .eq("status", "VERIFIED"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "COMPLETED"),
  ]);

  return {
    activeListings: listings.count ?? 0,
    verifiedBusinesses: verified.count ?? 0,
    completedDeals: deals.count ?? 0,
    mode: "supabase",
  };
}
