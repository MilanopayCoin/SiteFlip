import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { writeAuditLog } from "@/lib/marketplace/audit";

export const runtime = "nodejs";

const openSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().min(3).max(4000),
});

/**
 * GET /api/disputes — list disputes for current user (as party).
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (!(user.mode === "supabase" && isSupabaseConfigured())) {
    return jsonOk({ disputes: [], mode: "demo", userId: user.id });
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data, error } = await supabase
    .from("disputes")
    .select("*, transaction:transactions(*)")
    .or(`opened_by.eq.${user.id},against_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ disputes: data ?? [], mode: "supabase", userId: user.id });
}

/**
 * POST /api/disputes — open dispute (blocks payout → BLOCKED).
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const parsed = openSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  if (!(user.mode === "supabase" && isSupabaseConfigured())) {
    return jsonError("Supabase required to open disputes", 503);
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", parsed.data.transactionId)
    .maybeSingle();

  if (!tx) return jsonError("Transaction not found", 404);
  if (tx.buyer_id !== user.id && tx.seller_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const againstUserId =
    tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id;

  const { data: existing } = await supabase
    .from("disputes")
    .select("id")
    .eq("transaction_id", tx.id)
    .in("status", ["OPEN", "UNDER_REVIEW"])
    .maybeSingle();

  if (existing) {
    return jsonError("An open dispute already exists for this deal", 409);
  }

  const writer = (await createServiceClient()) || supabase;
  const now = new Date().toISOString();

  const { data: dispute, error } = await writer
    .from("disputes")
    .insert({
      transaction_id: tx.id,
      opened_by: user.id,
      against_user_id: againstUserId,
      reason: parsed.data.reason,
      status: "OPEN",
    })
    .select("*")
    .single();

  if (error || !dispute) {
    return jsonError(error?.message || "Failed to open dispute", 500);
  }

  await writer
    .from("transactions")
    .update({
      status: "DISPUTED",
      funds_state: "DISPUTED",
      updated_at: now,
    })
    .eq("id", tx.id);

  await writer.from("transaction_events").insert({
    transaction_id: tx.id,
    from_status: tx.status,
    to_status: "DISPUTED",
    actor_id: user.id,
    note: `Dispute opened: ${parsed.data.reason.slice(0, 200)}`,
  });

  // Block payout
  const { data: payout } = await writer
    .from("payouts")
    .select("id, status")
    .eq("transaction_id", tx.id)
    .maybeSingle();

  if (payout) {
    await writer
      .from("payouts")
      .update({
        status: "BLOCKED",
        blocked_reason: "Open dispute",
        updated_at: now,
      })
      .eq("id", payout.id);
  } else {
    await writer.from("payouts").insert({
      transaction_id: tx.id,
      seller_id: tx.seller_id,
      amount: tx.seller_amount ?? tx.amount,
      currency: tx.currency || "EUR",
      status: "BLOCKED",
      blocked_reason: "Open dispute",
    });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "dispute_opened",
    targetType: "transaction",
    targetId: tx.id,
    after: { disputeId: dispute.id, status: "OPEN" },
    reason: parsed.data.reason,
  });

  return jsonOk({ dispute, mode: "supabase" }, 201);
}
