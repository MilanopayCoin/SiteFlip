import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { writeAuditLog } from "@/lib/marketplace/audit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  note: z.string().max(2000).optional(),
});

/**
 * POST /api/deals/[id]/accept — buyer accepts delivery.
 * Sets funds_state ACCEPTED; payout → ELIGIBLE if no open dispute.
 */
export async function POST(request: Request, context: Ctx) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const { id } = await context.params;
  if (!id) return jsonError("Missing deal id", 400);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  if (!(user.mode === "supabase" && isSupabaseConfigured())) {
    return jsonError("Supabase required for accept", 503);
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tx) return jsonError("Deal not found", 404);
  if (tx.buyer_id !== user.id) return jsonError("Only buyer can accept delivery", 403);

  if (tx.funds_state !== "DELIVERED") {
    return jsonError("Delivery must be submitted before accept", 400);
  }
  if (tx.funds_state === "ACCEPTED") {
    return jsonError("Already accepted", 400);
  }

  const { data: openDispute } = await supabase
    .from("disputes")
    .select("id")
    .eq("transaction_id", id)
    .in("status", ["OPEN", "UNDER_REVIEW"])
    .maybeSingle();

  if (openDispute) {
    return jsonError("Cannot accept while a dispute is open", 400);
  }

  const now = new Date().toISOString();
  const writer = (await createServiceClient()) || supabase;

  const { data: updated, error } = await writer
    .from("transactions")
    .update({
      funds_state: "ACCEPTED",
      buyer_accepted_at: now,
      status: "COMPLETED",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  await writer.from("transaction_events").insert({
    transaction_id: id,
    from_status: tx.status,
    to_status: "COMPLETED",
    actor_id: user.id,
    note: parsed.data.note || "Buyer accepted delivery",
  });

  // Payout → ELIGIBLE if no open dispute
  const { data: payout } = await writer
    .from("payouts")
    .select("*")
    .eq("transaction_id", id)
    .maybeSingle();

  if (payout && ["PENDING", "BLOCKED"].includes(payout.status)) {
    await writer
      .from("payouts")
      .update({
        status: "ELIGIBLE",
        eligible_at: now,
        blocked_reason: null,
        updated_at: now,
      })
      .eq("id", payout.id);
  } else if (!payout) {
    await writer.from("payouts").insert({
      transaction_id: id,
      seller_id: tx.seller_id,
      amount: tx.seller_amount ?? tx.amount,
      currency: tx.currency || "EUR",
      status: "ELIGIBLE",
      eligible_at: now,
    });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "delivery_accepted",
    targetType: "transaction",
    targetId: id,
    before: { funds_state: tx.funds_state, status: tx.status },
    after: { funds_state: "ACCEPTED", status: "COMPLETED", payout: "ELIGIBLE" },
  });

  return jsonOk({ deal: updated, mode: "supabase" });
}
