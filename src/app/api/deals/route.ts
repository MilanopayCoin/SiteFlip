import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchListingById } from "@/lib/data/marketplace-data";
import { getListingById } from "@/lib/data/demo";
import { memoryStore } from "@/lib/data/memory-store";
import { calculateCommission } from "@/lib/marketplace/commission";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

const createSchema = z.object({
  listingId: z.string().min(1),
  type: z.enum(["BUY", "REVIVE"]).optional(),
});

/**
 * GET /api/deals — list current user's transactions (buyer or seller)
 * with listing + business join.
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase" && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return jsonError("Database unavailable", 503);

    const { data, error } = await supabase
      .from("transactions")
      .select(
        `*, listing:listings(*, business:businesses(*)), business:businesses(*)`
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return jsonOk({ deals: data ?? [], mode: "supabase", userId: user.id });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  return jsonOk({
    deals: memoryStore.listTransactions(user.id),
    mode: "demo",
    userId: user.id,
  });
}

/**
 * POST /api/deals — create a deal from listingId (BUY / REVIVE).
 * Persists terms_snapshot + server-side commission fields.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const { listing } = await fetchListingById(parsed.data.listingId);
  const listingRow = listing ?? getListingById(parsed.data.listingId);
  if (!listingRow) return jsonError("Listing not found", 404);
  if (listingRow.seller_id === user.id) {
    return jsonError("Cannot buy your own listing", 400);
  }
  if (listingRow.status !== "ACTIVE" && !listingRow.is_demo) {
    return jsonError("Listing is not available for purchase", 400);
  }

  const listingType = listingRow.listing_type;
  const dealType =
    parsed.data.type === "REVIVE" || listingType === "REVIVE"
      ? "REVIVE_ACQUISITION"
      : "BUY";

  if (!["BUY", "SELL", "REVIVE"].includes(listingType) && !parsed.data.type) {
    return jsonError("Listing type does not support BUY/REVIVE deal", 400);
  }

  const amount = Number(listingRow.price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Listing has no valid price", 400);
  }

  const currency = listingRow.currency || "EUR";
  let commission;
  try {
    commission = calculateCommission(amount, currency);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Invalid commission",
      400
    );
  }

  const termsSnapshot = {
    listingId: listingRow.id,
    listingType,
    title: listingRow.title,
    price: amount,
    currency,
    businessId: listingRow.business_id,
    sellerId: listingRow.seller_id,
    createdAt: new Date().toISOString(),
  };

  const status = "PAYMENT_PENDING";
  const txType = dealType;

  if (user.mode === "supabase" && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return jsonError("Database unavailable", 503);

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        type: txType,
        status,
        listing_id: listingRow.id,
        business_id: listingRow.business_id,
        buyer_id: user.id,
        seller_id: listingRow.seller_id,
        amount,
        currency,
        platform_fee: commission.platformFee,
        payment_fee: commission.paymentFee,
        seller_amount: commission.sellerAmount,
        commission_rate: commission.commissionRate,
        funds_state: "CREATED",
        terms_snapshot: termsSnapshot,
        notes: "Deal created. Payment not yet initiated. Not escrow.",
      })
      .select(
        `*, listing:listings(*, business:businesses(*)), business:businesses(*)`
      )
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to create deal", 500);
    }

    await supabase.from("transaction_events").insert({
      transaction_id: data.id,
      from_status: null,
      to_status: status,
      actor_id: user.id,
      note: "Deal initiated from listing",
    });

    return jsonOk({ deal: data, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const tx = memoryStore.createTransaction({
    type: txType,
    listing_id: listingRow.id,
    business_id: listingRow.business_id,
    buyer_id: user.id,
    seller_id: listingRow.seller_id,
    amount,
    currency,
  });
  memoryStore.updateTransaction(tx.id, status);

  return jsonOk({
    deal: tx,
    mode: "demo",
    notice: "DEMO deal — connect Supabase to persist",
  }, 201);
}
