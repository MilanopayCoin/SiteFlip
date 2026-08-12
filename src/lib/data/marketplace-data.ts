/**
 * Marketplace data access — Supabase when configured, DEMO fallback otherwise.
 * Demo records are always labeled is_demo / DEMO.
 * When Supabase is configured, never silently fall back to demo seed data.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  DEMO_BUSINESSES,
  DEMO_EVENTS,
  DEMO_LISTINGS,
  DEMO_SELLERS,
  getEnrichedListings,
} from "@/lib/data/demo";
import { filterListings } from "@/lib/marketplace";
import type {
  Business,
  Listing,
  MarketplaceFilters,
  Profile,
  BusinessEvent,
  BusinessVerification,
} from "@/types/database";
import { memoryStore } from "@/lib/data/memory-store";

export type DataMode = "supabase" | "demo";

export function getDataMode(): DataMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

function markDemoListing(l: Listing): Listing {
  return {
    ...l,
    is_demo: true,
    business: l.business
      ? { ...l.business, is_demo: true }
      : l.business,
  };
}

async function ensureEnv() {
  try {
    const { ensureCloudflareEnv } = await import("@/lib/supabase/env");
    await ensureCloudflareEnv();
  } catch {
    // ignore
  }
}

export async function fetchMarketplaceListings(
  filters: MarketplaceFilters = {},
  opts?: { page?: number; pageSize?: number }
): Promise<{
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  mode: DataMode;
  error?: string;
}> {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 24;
  await ensureEnv();
  const mode = getDataMode();

  if (mode === "supabase") {
    const supabase = await createClient();
    if (!supabase) {
      return {
        listings: [],
        total: 0,
        page,
        pageSize,
        mode,
        error: "Supabase client unavailable",
      };
    }

    let query = supabase
      .from("listings")
      .select(
        `*, business:businesses(*), seller:profiles!listings_seller_id_fkey(*)`,
        { count: "exact" }
      )
      .in("status", ["ACTIVE"])
      .order("created_at", { ascending: false });

    if (filters.listingType && filters.listingType !== "ALL") {
      if (filters.listingType === "BUY") {
        query = query.in("listing_type", ["BUY", "SELL"]);
      } else if (filters.listingType === "RENT") {
        query = query.in("listing_type", ["RENT", "RENT_TO_OWN"]);
      } else {
        query = query.eq("listing_type", filters.listingType);
      }
    }
    if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) {
      return {
        listings: [],
        total: 0,
        page,
        pageSize,
        mode,
        error: "Failed to load listings",
      };
    }

    let listings = (data as unknown as Listing[]) ?? [];
    listings = filterListings(
      {
        ...filters,
        listingType: "ALL",
        search: undefined,
        minPrice: undefined,
        maxPrice: undefined,
      },
      listings
    );

    const businessIds = [
      ...new Set(listings.map((l) => l.business_id).filter(Boolean)),
    ];
    if (businessIds.length) {
      const { data: vers } = await supabase
        .from("business_verifications")
        .select("*")
        .in("business_id", businessIds)
        .eq("status", "VERIFIED");
      const byBiz = new Map<string, BusinessVerification[]>();
      for (const v of (vers as BusinessVerification[]) ?? []) {
        const arr = byBiz.get(v.business_id) ?? [];
        arr.push(v);
        byBiz.set(v.business_id, arr);
      }
      listings = listings.map((l) => ({
        ...l,
        verifications: byBiz.get(l.business_id) ?? [],
      }));
    }

    return {
      listings,
      total: count ?? listings.length,
      page,
      pageSize,
      mode,
    };
  }

  // DEMO fallback only when Supabase is not configured
  const memoryListings = memoryStore.listListings().map(markDemoListing);
  const demo = getEnrichedListings().map(markDemoListing);
  const all = [...memoryListings, ...demo];
  const filtered = filterListings(filters, all);
  const start = (page - 1) * pageSize;
  return {
    listings: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    mode: "demo",
  };
}

export async function fetchListingById(id: string): Promise<{
  listing: Listing | null;
  mode: DataMode;
  error?: string;
}> {
  await ensureEnv();
  const mode = getDataMode();
  if (mode === "supabase") {
    const supabase = await createClient();
    if (!supabase) return { listing: null, mode, error: "unavailable" };
    const { data, error } = await supabase
      .from("listings")
      .select(
        `*, business:businesses(*), seller:profiles!listings_seller_id_fkey(*)`
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { listing: null, mode, error: "Failed to load listing" };
    if (!data) return { listing: null, mode };
    const listing = data as unknown as Listing;
    const { data: vers } = await supabase
      .from("business_verifications")
      .select("*")
      .eq("business_id", listing.business_id)
      .eq("status", "VERIFIED");
    listing.verifications = (vers as BusinessVerification[]) ?? [];
    return { listing, mode };
  }

  const mem = memoryStore.getListing(id);
  if (mem) return { listing: markDemoListing(mem), mode: "demo" };
  const demo = getEnrichedListings().find((l) => l.id === id);
  return { listing: demo ? markDemoListing(demo) : null, mode: "demo" };
}

export async function fetchBusinessByIdOrSlug(idOrSlug: string): Promise<{
  business: Business | null;
  mode: DataMode;
}> {
  await ensureEnv();
  const mode = getDataMode();
  if (mode === "supabase") {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
        .maybeSingle();
      if (data) return { business: data as Business, mode };
      return { business: null, mode };
    }
  }
  const mem = memoryStore.getBusiness(idOrSlug);
  if (mem) return { business: { ...mem, is_demo: true }, mode: "demo" };
  const demo = DEMO_BUSINESSES.find(
    (b) => b.id === idOrSlug || b.slug === idOrSlug
  );
  return {
    business: demo ? { ...demo, is_demo: true } : null,
    mode: "demo",
  };
}

export async function fetchBusinessEvents(
  businessId: string
): Promise<BusinessEvent[]> {
  await ensureEnv();
  if (getDataMode() === "supabase") {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase
        .from("business_events")
        .select("*")
        .eq("business_id", businessId)
        .order("occurred_at", { ascending: true });
      return (data as BusinessEvent[]) ?? [];
    }
    return [];
  }
  return [
    ...memoryStore.listEvents(businessId),
    ...DEMO_EVENTS.filter((e) => e.business_id === businessId),
  ];
}

export async function fetchSeller(sellerId: string): Promise<Profile | null> {
  await ensureEnv();
  if (getDataMode() === "supabase") {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sellerId)
        .maybeSingle();
      return (data as Profile) ?? null;
    }
    return null;
  }
  return (
    memoryStore.getProfile(sellerId) ??
    DEMO_SELLERS.find((s) => s.id === sellerId) ??
    null
  );
}

export { DEMO_LISTINGS, DEMO_BUSINESSES, DEMO_SELLERS };
