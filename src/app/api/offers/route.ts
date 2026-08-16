import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { fetchListingById } from "@/lib/data/marketplace-data";
import { getListingById } from "@/lib/data/demo";

const createSchema = z.object({
  listingId: z.string().min(1),
  amount: z.coerce.number().positive(),
  message: z.string().max(2000).optional(),
  currency: z.string().default("EUR"),
});

const actionSchema = z.object({
  offerId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "COUNTER", "CANCEL"]),
  amount: z.coerce.number().positive().optional(),
  message: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("offers")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return jsonOk({ offers: data, mode: "supabase", userId: user.id });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  return jsonOk({
    offers: memoryStore.listOffersForUser(user.id),
    mode: "demo",
    userId: user.id,
  });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const body = await request.json();

  // Action on existing offer
  if (body.action && body.offerId) {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return jsonError("Validation failed", 400);
    return handleAction(user, parsed.data);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const { listing } = await fetchListingById(parsed.data.listingId);
  const demoListing = listing ?? getListingById(parsed.data.listingId);
  if (!demoListing) return jsonError("Listing not found", 404);
  if (demoListing.seller_id === user.id) {
    return jsonError("Cannot offer on your own listing", 400);
  }

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("offers")
      .insert({
        listing_id: demoListing.id,
        buyer_id: user.id,
        seller_id: demoListing.seller_id,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        message: parsed.data.message ?? null,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error) return jsonError(error.message, 500);

    await supabase!.from("offer_events").insert({
      offer_id: data.id,
      from_status: null,
      to_status: "PENDING",
      actor_id: user.id,
      amount: parsed.data.amount,
      message: parsed.data.message ?? null,
    });

    // Start conversation
    await supabase!.from("conversations").insert({
      listing_id: demoListing.id,
      offer_id: data.id,
      business_id: demoListing.business_id,
      participant_ids: [user.id, demoListing.seller_id],
    });

    return jsonOk({ offer: data, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const offer = memoryStore.createOffer({
    listing_id: demoListing.id,
    buyer_id: user.id,
    seller_id: demoListing.seller_id,
    amount: parsed.data.amount,
    message: parsed.data.message,
    currency: parsed.data.currency,
  });
  memoryStore.getOrCreateConversation({
    participant_ids: [user.id, demoListing.seller_id],
    listing_id: demoListing.id,
    offer_id: offer.id,
    business_id: demoListing.business_id,
  });

  return jsonOk({ offer, mode: "demo" }, 201);
}

async function handleAction(
  user: { id: string; mode: "supabase" | "demo" },
  input: z.infer<typeof actionSchema>
) {
  const statusMap = {
    ACCEPT: "ACCEPTED",
    REJECT: "REJECTED",
    COUNTER: "COUNTERED",
    CANCEL: "CANCELLED",
  } as const;
  const to = statusMap[input.action];

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data: offer } = await supabase!
      .from("offers")
      .select("*")
      .eq("id", input.offerId)
      .maybeSingle();
    if (!offer) return jsonError("Offer not found", 404);
    if (offer.buyer_id !== user.id && offer.seller_id !== user.id) {
      return jsonError("Forbidden", 403);
    }
    if (input.action === "CANCEL" && offer.buyer_id !== user.id) {
      return jsonError("Only buyer can cancel", 403);
    }
    // Seller: accept/reject/counter. Buyer: accept/counter a COUNTERED offer; cancel PENDING.
    const buyerRespondingToCounter =
      offer.buyer_id === user.id &&
      offer.status === "COUNTERED" &&
      (input.action === "ACCEPT" || input.action === "COUNTER" || input.action === "REJECT");
    if (
      (input.action === "ACCEPT" ||
        input.action === "REJECT" ||
        input.action === "COUNTER") &&
      offer.seller_id !== user.id &&
      !buyerRespondingToCounter
    ) {
      return jsonError("Not allowed", 403);
    }

    const { data, error } = await supabase!
      .from("offers")
      .update({
        status: to,
        amount: input.amount ?? offer.amount,
        message: input.message ?? offer.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 500);

    await supabase!.from("offer_events").insert({
      offer_id: offer.id,
      from_status: offer.status,
      to_status: to,
      actor_id: user.id,
      amount: input.amount ?? offer.amount,
      message: input.message ?? null,
    });

    if (to === "ACCEPTED") {
      await supabase!.from("transactions").insert({
        type: "BUY",
        status: "ACCEPTED",
        listing_id: offer.listing_id,
        business_id: (
          await supabase!
            .from("listings")
            .select("business_id")
            .eq("id", offer.listing_id)
            .single()
        ).data?.business_id,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        amount: data.amount,
        notes: "Not escrow. Payment pending configuration.",
      });
    }

    return jsonOk({ offer: data, mode: "supabase" });
  }

  const existing = memoryStore.getOffer(input.offerId);
  if (!existing) return jsonError("Offer not found", 404);
  if (existing.buyer_id !== user.id && existing.seller_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const updated = memoryStore.updateOfferStatus(input.offerId, to, user.id, {
    amount: input.amount,
    message: input.message,
  });

  if (to === "ACCEPTED" && updated) {
    const listing = memoryStore.getListing(updated.listing_id);
    memoryStore.createTransaction({
      type: "BUY",
      listing_id: updated.listing_id,
      business_id: listing?.business_id ?? "unknown",
      buyer_id: updated.buyer_id,
      seller_id: updated.seller_id,
      amount: updated.amount,
    });
    memoryStore.updateTransaction(
      memoryStore.listTransactions(user.id)[0]?.id ?? "",
      "ACCEPTED"
    );
  }

  return jsonOk({ offer: updated, mode: "demo" });
}
