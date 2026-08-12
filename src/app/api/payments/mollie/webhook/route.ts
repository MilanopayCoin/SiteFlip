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
        });
      }

      if (transactionId && mapped === "paid") {
        const { data: tx } = await service
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .maybeSingle();

        if (tx && tx.status !== "PAYMENT_RECEIVED" && tx.status !== "COMPLETED") {
          const next: TransactionStatus = "PAYMENT_RECEIVED";
          if (canTransition(tx.status, next) || tx.status === "PAYMENT_PENDING") {
            await service
              .from("transactions")
              .update({
                status: next,
                payment_provider: "mollie",
                payment_ref: paymentId,
                updated_at: new Date().toISOString(),
                notes:
                  "Mollie payment verified server-side. Not escrow. Ownership transfer still requires SITEFLIP workflow.",
              })
              .eq("id", transactionId);

            await service.from("transaction_events").insert({
              transaction_id: transactionId,
              from_status: tx.status,
              to_status: next,
              actor_id: null,
              note: "Mollie webhook: payment paid (verified). Not escrow. No automatic ownership transfer.",
            });
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
