import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { fetchListingById } from "@/lib/data/marketplace-data";
import { getListingById } from "@/lib/data/demo";

const requestSchema = z.object({
  listingId: z.string().min(1),
  message: z.string().max(2000).optional(),
  monthlyRent: z.coerce.number().positive().optional(),
  minMonths: z.coerce.number().min(1).optional(),
  rentToOwn: z.boolean().optional(),
  purchasePrice: z.coerce.number().positive().optional(),
  creditPercent: z.coerce.number().min(0).max(100).optional(),
});

const actionSchema = z.object({
  rentalId: z.string().min(1),
  status: z.enum([
    "ACCEPTED",
    "REJECTED",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
  ]),
});

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("rental_requests")
      .select("*")
      .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) return jsonError("Failed to load rentals", 500);
    return jsonOk({ rentals: data ?? [], mode: "supabase" });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  return jsonOk({
    rentals: memoryStore.listRentalRequests(user.id),
    mode: "demo",
  });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const body = await request.json().catch(() => ({}));

  if (body.rentalId && body.status) {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    return handleStatus(user, parsed.data);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Validation failed", 400);

  const { listing } = await fetchListingById(parsed.data.listingId);
  const found =
    listing ??
    getListingById(parsed.data.listingId) ??
    memoryStore.getListing(parsed.data.listingId);
  if (!found) return jsonError("Listing not found", 404);
  if (found.seller_id === user.id) {
    return jsonError("Cannot rent your own listing", 400);
  }
  if (!["RENT", "RENT_TO_OWN"].includes(found.listing_type)) {
    return jsonError("Listing is not available for rent", 400);
  }

  const monthlyRent =
    parsed.data.monthlyRent ?? found.rental_price_monthly ?? 0;
  if (!monthlyRent) return jsonError("Monthly rent required", 400);

  const rentToOwn =
    parsed.data.rentToOwn ?? found.listing_type === "RENT_TO_OWN";
  const purchasePrice = parsed.data.purchasePrice ?? found.price ?? null;
  const creditPercent =
    parsed.data.creditPercent ?? found.rent_to_own_credit_percent ?? null;
  const minMonths =
    parsed.data.minMonths ?? found.rent_to_own_period_months ?? 1;

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("rental_requests")
      .insert({
        listing_id: found.id,
        business_id: found.business_id,
        requester_id: user.id,
        owner_id: found.seller_id,
        monthly_price: monthlyRent,
        minimum_months: minMonths,
        is_rent_to_own: rentToOwn,
        purchase_price: purchasePrice,
        credit_percent: creditPercent,
        message: parsed.data.message ?? null,
        status: "REQUESTED",
      })
      .select("*")
      .single();
    if (error) return jsonError("Failed to create rental request", 500);
    return jsonOk(
      {
        rental: data,
        mode: "supabase",
        notice:
          "Rental request created. Not a legally binding contract or escrow.",
      },
      201
    );
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const rental = memoryStore.createRentalRequest({
    listing_id: found.id,
    business_id: found.business_id,
    requester_id: user.id,
    owner_id: found.seller_id,
    monthly_price: monthlyRent,
    minimum_months: minMonths,
    is_rent_to_own: rentToOwn,
    credit_percent: creditPercent,
    purchase_price: purchasePrice,
    message: parsed.data.message ?? null,
  });

  return jsonOk(
    {
      rental,
      mode: "demo",
      notice:
        "DEMO rental request. Not a legally binding contract or escrow. Estimates only.",
    },
    201
  );
}

async function handleStatus(
  user: { id: string; mode: "supabase" | "demo" },
  input: z.infer<typeof actionSchema>
) {
  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data: existing } = await supabase!
      .from("rental_requests")
      .select("*")
      .eq("id", input.rentalId)
      .maybeSingle();
    if (!existing) return jsonError("Not found", 404);
    if (existing.owner_id !== user.id && existing.requester_id !== user.id) {
      return jsonError("Forbidden", 403);
    }
    const { data, error } = await supabase!
      .from("rental_requests")
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.rentalId)
      .select("*")
      .single();
    if (error) return jsonError("Failed to update", 500);

    if (input.status === "ACCEPTED" || input.status === "ACTIVE") {
      await supabase!.from("transactions").insert({
        type: existing.is_rent_to_own ? "RENT_TO_OWN" : "RENT",
        status: "ACCEPTED",
        listing_id: existing.listing_id,
        business_id: existing.business_id,
        buyer_id: existing.requester_id,
        seller_id: existing.owner_id,
        amount: existing.monthly_price,
        notes:
          "Not escrow. Contract architecture for future legal integration.",
      });
    }

    return jsonOk({ rental: data, mode: "supabase" });
  }

  const rentals = memoryStore.listRentalRequests(user.id);
  const existing = rentals.find((r) => r.id === input.rentalId);
  if (!existing) return jsonError("Not found", 404);
  if (existing.requester_id !== user.id && existing.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }
  const rental = memoryStore.updateRentalRequest(input.rentalId, input.status);
  return jsonOk({ rental, mode: "demo" });
}
