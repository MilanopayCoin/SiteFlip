import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createMolliePayment,
  isMollieConfigured,
  isMollieTestMode,
} from "@/lib/payments/mollie";
import { memoryStore } from "@/lib/data/memory-store";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

const createSchema = z.object({
  transactionId: z.string().min(1).optional(),
  listingId: z.string().min(1).optional(),
  businessId: z.string().min(1).optional(),
  sellerId: z.string().min(1).optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("EUR"),
  type: z
    .enum(["BUY", "RENT", "RENT_TO_OWN", "REVIVE_ACQUISITION"])
    .default("BUY"),
  description: z.string().max(255).optional(),
  redirectUrl: z.string().url().optional(),
});

/**
 * Create a Mollie Checkout payment for a JIY.APP transaction.
 * Mollie is a payment processor — NOT escrow.
 * Paid status does NOT transfer business ownership.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (!isMollieConfigured()) {
    return jsonError(
      "Mollie is not configured on this Worker. Add MOLLIE_API_KEY as an encrypted secret.",
      503
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://siteflip.miqomilano.workers.dev"
  ).replace(/\/$/, "");
  const webhookUrl =
    process.env.MOLLIE_WEBHOOK_URL ||
    `${appUrl}/api/payments/mollie/webhook`;
  const redirectUrl =
    input.redirectUrl || `${appUrl}/dashboard?payment=return`;
  const idempotencyKey = `mollie_${user.id}_${nanoid(12)}`;

  let transactionId = input.transactionId ?? null;
  let businessId = input.businessId ?? null;
  let sellerId = input.sellerId ?? null;
  let listingId = input.listingId ?? null;

  if (user.mode === "supabase" && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return jsonError("Database unavailable", 503);

    if (transactionId) {
      const { data: tx } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .maybeSingle();
      if (!tx) return jsonError("Transaction not found", 404);
      if (tx.buyer_id !== user.id) return jsonError("Forbidden", 403);
      businessId = tx.business_id;
      sellerId = tx.seller_id;
      listingId = tx.listing_id;
      if (
        !["INITIATED", "ACCEPTED", "PAYMENT_PENDING", "OFFERED"].includes(
          tx.status
        )
      ) {
        return jsonError(
          "Transaction is not payable in its current state",
          400
        );
      }
    } else {
      if (!businessId || !sellerId) {
        return jsonError(
          "businessId and sellerId required when creating a transaction",
          400
        );
      }
      if (sellerId === user.id) {
        return jsonError("Cannot pay yourself", 400);
      }
      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({
          type: input.type,
          status: "PAYMENT_PENDING",
          listing_id: listingId,
          business_id: businessId,
          buyer_id: user.id,
          seller_id: sellerId,
          amount: input.amount,
          currency: input.currency,
          payment_provider: "mollie",
          notes:
            "Mollie payment initiated. Not escrow. Ownership does not transfer on payment alone.",
        })
        .select("*")
        .single();
      if (error || !tx) return jsonError("Failed to create transaction", 500);
      transactionId = tx.id;
      await supabase.from("transaction_events").insert({
        transaction_id: transactionId,
        from_status: null,
        to_status: "PAYMENT_PENDING",
        actor_id: user.id,
        note: "Payment initiated via Mollie (not escrow)",
      });
    }

    let payment;
    try {
      payment = await createMolliePayment({
        amount: input.amount,
        currency: input.currency,
        description: input.description || `JIY.APP ${input.type} payment`,
        redirectUrl,
        webhookUrl,
        metadata: {
          transactionId: transactionId!,
          buyerId: user.id,
          businessId: businessId || "",
          listingId: listingId || "",
          purpose: input.type,
        },
      });
    } catch {
      return jsonError("Failed to create Mollie payment", 502);
    }

    const checkoutUrl =
      payment.checkoutUrl || payment._links?.checkout?.href || null;

    const writer = (await createServiceClient()) || supabase;
    const { error: payErr } = await writer.from("payments").insert({
      user_id: user.id,
      amount: input.amount,
      currency: input.currency,
      provider: "mollie",
      provider_ref: payment.id,
      purpose: input.type,
      status: payment.status,
      transaction_id: transactionId,
      checkout_url: checkoutUrl,
      idempotency_key: idempotencyKey,
      raw_status: payment.status,
      updated_at: new Date().toISOString(),
    });
    if (payErr) {
      // Transaction + payment_ref still authoritative; surface payment row failure honestly
      console.error("payments insert failed", payErr.message);
    }
    await supabase
      .from("transactions")
      .update({
        status: "PAYMENT_PENDING",
        payment_provider: "mollie",
        payment_ref: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    return jsonOk({
      transactionId,
      paymentId: payment.id,
      checkoutUrl,
      status: payment.status,
      testMode: isMollieTestMode(),
      isEscrow: false,
      idempotencyKey,
      notice:
        "Mollie processes payment only. This is not escrow. Ownership does not transfer automatically when paid.",
    });
  }

  // DEMO memory path only when Supabase Auth is not configured
  const { getSchemaStatus } = await import("@/lib/supabase/schema-ready");
  const status = await getSchemaStatus();
  if (status.productionPersistence || isSupabaseConfigured()) {
    return jsonError(
      status.productionPersistence
        ? "Supabase payment path required — DEMO fallback disabled"
        : "Supabase session required for payments. Schema may not be applied yet (migrations 001–004).",
      503,
      {
        schemaReady: status.schemaReady,
        note: status.reason,
      }
    );
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const existing =
    transactionId &&
    memoryStore.listTransactions(user.id).find((t) => t.id === transactionId);
  const tx =
    existing ||
    memoryStore.createTransaction({
      type: input.type,
      listing_id: listingId,
      business_id: businessId || "unknown",
      buyer_id: user.id,
      seller_id: sellerId || "unknown",
      amount: input.amount,
      currency: input.currency,
    });
  memoryStore.updateTransaction(tx.id, "PAYMENT_PENDING");

  let payment;
  try {
    payment = await createMolliePayment({
      amount: input.amount,
      currency: input.currency,
      description: input.description || `JIY.APP ${input.type} payment`,
      redirectUrl,
      webhookUrl,
      metadata: {
        transactionId: tx.id,
        buyerId: user.id,
        purpose: input.type,
        mode: "demo_memory",
      },
    });
  } catch {
    return jsonError("Failed to create Mollie payment", 502);
  }

  return jsonOk({
    transactionId: tx.id,
    paymentId: payment.id,
    checkoutUrl: payment.checkoutUrl || payment._links?.checkout?.href || null,
    status: payment.status,
    testMode: isMollieTestMode(),
    mode: "demo",
    isEscrow: false,
    notice:
      "Mollie payment created. Not escrow. DEMO persistence until Supabase schema is ready.",
  });
}

export async function GET() {
  await ensureCloudflareEnv();
  return jsonOk({
    configured: isMollieConfigured(),
    testMode: isMollieConfigured() ? isMollieTestMode() : null,
    isEscrow: false,
    capabilities: {
      createPayment: true,
      paymentStatus: true,
      webhook: true,
      idempotency: true,
      transactionLinkage: true,
      realPaymentExecuted: false,
    },
    endpoints: {
      create: "/api/payments/mollie/create",
      webhook: "/api/payments/mollie/webhook",
    },
    notice:
      "JIY.APP uses Mollie as payment processor only — not escrow. No real payment is created by this health check.",
  });
}
