import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatusToPayment,
} from "@/lib/payments/mollie";
import { canTransition } from "@/lib/transactions/provider";
import { memoryStore } from "@/lib/data/memory-store";
import { writeAuditLog } from "@/lib/marketplace/audit";
import { fundsStateAfterPaymentPaid } from "@/lib/marketplace/commission";
import type { TransactionStatus } from "@/types/database";

export const runtime = "nodejs";

/**
 * Mollie webhook.
 *
 * Mollie POSTs application/x-www-form-urlencoded with `id=tr_...`.
 * We ALWAYS re-fetch payment status from Mollie server-side.
 * Never trust the browser redirect as payment confirmation.
 *
 * Idempotent: repeated webhooks for the same paid payment are safe.
 * Paid ≠ ownership transfer. Not escrow.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();

  if (!isMollieConfigured()) {
    return Response.json(
      { error: "Mollie not configured" },
      { status: 503 }
    );
  }

  let paymentId = "";
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      paymentId = String(body.id || body.paymentId || "");
    } else {
      const form = await request.formData();
      paymentId = String(form.get("id") || "");
    }
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!paymentId || !/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
    return Response.json({ error: "Missing payment id" }, { status: 400 });
  }

  let payment;
  try {
    payment = await getMolliePayment(paymentId);
  } catch {
    return Response.json({ error: "Unable to verify payment" }, { status: 502 });
  }

  const mapped = mapMollieStatusToPayment(String(payment.status));
  const meta = payment.metadata || {};
  const transactionId = meta.transactionId || null;

  // Persist payment + transaction updates
  if (isSupabaseConfigured()) {
    const service =
      (await createServiceClient()) || (await createClient());
    if (service) {
      // Idempotent payment row update by provider_ref
      const { data: existing } = await service
        .from("payments")
        .select("id, status")
        .eq("provider", "mollie")
        .eq("provider_ref", paymentId)
        .maybeSingle();

      if (existing) {
        if (existing.status !== mapped) {
          await service
            .from("payments")
            .update({
              status: mapped,
              raw_status: payment.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        }
      } else if (meta.buyerId) {
        await service.from("payments").insert({
          user_id: meta.buyerId,
          amount: Number(payment.amount?.value || 0),
          currency: payment.amount?.currency || "EUR",
          provider: "mollie",
          provider_ref: paymentId,
          purpose: meta.purpose || "BUY",
          status: mapped,
          transaction_id: transactionId,
        });
      }

      if (transactionId && mapped === "paid") {
        const { data: tx } = await service
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .maybeSingle();

        if (tx) {
          // Idempotent: already PAYMENT_RECEIVED → skip duplicate side effects
          if (tx.status === "PAYMENT_RECEIVED" || tx.status === "COMPLETED") {
            // still ensure funds_state is set if missing
            if (!tx.funds_state || tx.funds_state === "PAYMENT_PENDING") {
              await service
                .from("transactions")
                .update({
                  funds_state: fundsStateAfterPaymentPaid(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", transactionId);
            }
          } else {
            const next: TransactionStatus = "PAYMENT_RECEIVED";
            if (
              canTransition(tx.status, next) ||
              tx.status === "PAYMENT_PENDING"
            ) {
              const fundsState = fundsStateAfterPaymentPaid(); // HELD_OR_ROUTED
              await service
                .from("transactions")
                .update({
                  status: next,
                  funds_state: fundsState,
                  payment_provider: "mollie",
                  payment_ref: paymentId,
                  updated_at: new Date().toISOString(),
                  notes:
                    "Mollie payment verified server-side. Not escrow. Ownership transfer still requires JIY.APP workflow.",
                })
                .eq("id", transactionId);

              await service.from("transaction_events").insert({
                transaction_id: transactionId,
                from_status: tx.status,
                to_status: next,
                actor_id: null,
                note: "Mollie webhook: payment paid (verified). Funds HELD_OR_ROUTED. Not escrow. No automatic ownership transfer.",
              });

              // Create payout row PENDING if not exists (amount = seller_amount)
              const sellerAmount =
                tx.seller_amount != null
                  ? Number(tx.seller_amount)
                  : Number(tx.amount);
              const { data: existingPayout } = await service
                .from("payouts")
                .select("id")
                .eq("transaction_id", transactionId)
                .maybeSingle();
              if (!existingPayout) {
                await service.from("payouts").insert({
                  transaction_id: transactionId,
                  seller_id: tx.seller_id,
                  amount: sellerAmount,
                  currency: tx.currency || "EUR",
                  status: "PENDING",
                });
              }

              await writeAuditLog({
                actorId: null,
                action: "payment_confirmed",
                targetType: "transaction",
                targetId: transactionId,
                before: { status: tx.status, funds_state: tx.funds_state },
                after: {
                  status: next,
                  funds_state: fundsState,
                  payment_ref: paymentId,
                },
                reason: "Mollie webhook verified paid",
              });
            }
          }
        }
      } else if (transactionId && ["failed", "canceled", "expired"].includes(mapped)) {
        const { data: tx } = await service
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .maybeSingle();
        if (tx && tx.status === "PAYMENT_PENDING") {
          await service.from("transaction_events").insert({
            transaction_id: transactionId,
            from_status: tx.status,
            to_status: tx.status,
            actor_id: null,
            note: `Mollie webhook: payment ${mapped} (verified). Transaction remains PAYMENT_PENDING.`,
          });
        }
      }
    }
  } else if (transactionId) {
    // Demo memory
    const txs = memoryStore.listTransactions(meta.buyerId || "");
    const tx = txs.find((t) => t.id === transactionId);
    if (tx && mapped === "paid") {
      memoryStore.updateTransaction(tx.id, "PAYMENT_RECEIVED");
    }
  }

  // Mollie expects 200 OK
  return Response.json({
    received: true,
    paymentId,
    status: mapped,
    isEscrow: false,
    ownershipTransferred: false,
    notice:
      "Payment status verified with Mollie. Not escrow. Ownership was not transferred.",
  });
}

/** Health / existence check */
export async function GET() {
  await ensureCloudflareEnv();
  return Response.json({
    ok: true,
    configured: isMollieConfigured(),
    isEscrow: false,
  });
}
