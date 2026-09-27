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
 * POST /api/deals/[id]/delivery — seller submits delivery.
 * Sets funds_state DELIVERED + transaction event.
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
    return jsonError("Supabase required for delivery submission", 503);
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tx) return jsonError("Deal not found", 404);
  if (tx.seller_id !== user.id) return jsonError("Only seller can submit delivery", 403);

  if (!["PAYMENT_RECEIVED", "TRANSFER_PENDING", "INSPECTION"].includes(tx.status)) {
    return jsonError(
      "Delivery can only be submitted after payment is received",
      400
    );
  }
  if (tx.funds_state === "DELIVERED" || tx.funds_state === "ACCEPTED") {
    return jsonError("Delivery already submitted", 400);
  }

  const now = new Date().toISOString();
  const writer = (await createServiceClient()) || supabase;

  const { data: updated, error } = await writer
    .from("transactions")
    .update({
      funds_state: "DELIVERED",
      delivery_submitted_at: now,
      status: tx.status === "PAYMENT_RECEIVED" ? "TRANSFER_PENDING" : tx.status,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  await writer.from("transaction_events").insert({
    transaction_id: id,
    from_status: tx.status,
    to_status: updated.status,
    actor_id: user.id,
    note: parsed.data.note || "Seller submitted delivery",
  });

  await writeAuditLog({
    actorId: user.id,
    action: "delivery_submitted",
    targetType: "transaction",
    targetId: id,
    before: { funds_state: tx.funds_state },
    after: { funds_state: "DELIVERED" },
  });

  return jsonOk({ deal: updated, mode: "supabase" });
}
