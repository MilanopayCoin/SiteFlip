import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import type { MarketplaceFilters } from "@/types/database";

const createSchema = z.object({
  business_id: z.string().min(1),
  listing_type: z.enum(["BUY", "RENT", "RENT_TO_OWN", "REVIVE", "SELL"]),
  title: z.string().min(2).max(160),
  summary: z.string().max(2000).optional(),
  price: z.coerce.number().min(0).optional(),
  rental_price_monthly: z.coerce.number().min(0).optional(),
  rent_to_own_credit_percent: z.coerce.number().min(0).max(100).optional(),
  rent_to_own_period_months: z.coerce.number().min(1).optional(),
  minimum_rental_months: z.coerce.number().min(1).optional(),
  publish: z.boolean().optional(),
  currency: z.string().default("EUR"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "1";
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 24);

  if (mine) {
    const user = await resolveRequestUser(request);
    if (!user) return jsonError("Authentication required", 401);
    if (user.mode === "supabase") {
      const supabase = await createClient();
      const { data, error } = await supabase!
        .from("listings")
        .select(`*, business:businesses(*)`)
        .eq("seller_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) return jsonError(error.message, 500);
      return jsonOk({ listings: data, mode: "supabase" });
    }
    memoryStore.ensureDemoUser(user.id, user.email);
    return jsonOk({
      listings: memoryStore.listListingsForSeller(user.id),
      mode: "demo",
    });
  }

  const filters: MarketplaceFilters = {
    listingType: (url.searchParams.get("type") as MarketplaceFilters["listingType"]) || "ALL",
    category: (url.searchParams.get("category") as MarketplaceFilters["category"]) || "ALL",
    sort: (url.searchParams.get("sort") as MarketplaceFilters["sort"]) || "ai",
    search: url.searchParams.get("search") || undefined,
    minAiScore: url.searchParams.get("minAiScore")
      ? Number(url.searchParams.get("minAiScore"))
      : undefined,
    verifiedOnly: url.searchParams.get("verified") === "1",
    minPrice: url.searchParams.get("minPrice")
      ? Number(url.searchParams.get("minPrice"))
      : undefined,
    maxPrice: url.searchParams.get("maxPrice")
      ? Number(url.searchParams.get("maxPrice"))
      : undefined,
    minRevenue: url.searchParams.get("minRevenue")
      ? Number(url.searchParams.get("minRevenue"))
      : undefined,
    minProfit: url.searchParams.get("minProfit")
      ? Number(url.searchParams.get("minProfit"))
      : undefined,
  };

  const result = await fetchMarketplaceListings(filters, { page, pageSize });
  return jsonOk(result);
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }
  const input = parsed.data;
  const status = input.publish ? "ACTIVE" : "DRAFT";

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data: biz } = await supabase!
      .from("businesses")
      .select("id, current_owner_id")
      .eq("id", input.business_id)
      .maybeSingle();
    if (!biz || biz.current_owner_id !== user.id) {
      return jsonError("Business not found or not owned", 403);
    }

    const { data, error } = await supabase!
      .from("listings")
      .insert({
        business_id: input.business_id,
        seller_id: user.id,
        listing_type: input.listing_type,
        title: input.title,
        summary: input.summary ?? null,
        price: input.price ?? null,
        rental_price_monthly: input.rental_price_monthly ?? null,
        rent_to_own_credit_percent: input.rent_to_own_credit_percent ?? null,
        rent_to_own_period_months: input.rent_to_own_period_months ?? null,
        minimum_rental_months: input.minimum_rental_months ?? null,
        currency: input.currency,
        status,
        published_at: status === "ACTIVE" ? new Date().toISOString() : null,
        is_demo: false,
      })
      .select(`*, business:businesses(*)`)
      .single();
    if (error) return jsonError(error.message, 500);

    if (status === "ACTIVE") {
      await supabase!.from("business_events").insert({
        business_id: input.business_id,
        event_type: "listed",
        title: "Listed on SITEFLIP",
        description: `${input.listing_type} listing published`,
        created_by: user.id,
      });
    }

    return jsonOk({ listing: data, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const biz = memoryStore.getBusiness(input.business_id);
  if (!biz || biz.current_owner_id !== user.id) {
    return jsonError("Business not found or not owned", 403);
  }

  const listing = memoryStore.createListing({
    business_id: input.business_id,
    seller_id: user.id,
    listing_type: input.listing_type,
    title: input.title,
    summary: input.summary ?? null,
    price: input.price ?? null,
    rental_price_monthly: input.rental_price_monthly ?? null,
    rent_to_own_credit_percent: input.rent_to_own_credit_percent ?? null,
    rent_to_own_period_months: input.rent_to_own_period_months ?? null,
    currency: input.currency,
    status,
  });

  return jsonOk({
    listing,
    mode: "demo",
    notice: "DEMO listing — connect Supabase to persist",
  }, 201);
}
