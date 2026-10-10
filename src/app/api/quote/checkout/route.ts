import { z } from "zod";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import {
  canCreateMolliePayments,
  createMolliePayment,
  isMollieConfigured,
  isMollieLiveMode,
  isMollieLivePaymentsAllowed,
  isMollieTestMode,
  molliePaymentBlockReason,
} from "@/lib/payments/mollie";
import {
  QUOTE_PDF_PRICE_EUR,
  QUOTE_PDF_PURPOSE,
} from "@/lib/quote/types";
import { getQuoteById, updateQuotePayment } from "@/lib/quote/store";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  quoteId: z.string().min(8).max(40),
  downloadToken: z.string().min(8).max(64),
});

/**
 * Guest Mollie checkout for JIY Quote PDF unlock (€1.00 EUR fixed).
 * Separate from marketplace /api/payments/mollie/create (auth required).
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();

  const blockReason = molliePaymentBlockReason();
  if (blockReason) {
    return jsonError(blockReason, isMollieConfigured() ? 403 : 503, {
      testMode: isMollieConfigured() ? isMollieTestMode() : null,
      liveMode: isMollieConfigured() ? isMollieLiveMode() : null,
      liveBlocked:
        isMollieConfigured() &&
        isMollieLiveMode() &&
        !isMollieLivePaymentsAllowed(),
    });
  }

  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const order = await getQuoteById(parsed.data.quoteId);
  if (!order) return jsonError("Quote not found", 404);
  if (order.downloadToken !== parsed.data.downloadToken) {
    return jsonError("Invalid download token", 403);
  }
  if (order.status === "paid") {
    return jsonOk({
      quoteId: order.id,
      status: "paid",
      alreadyPaid: true,
      checkoutUrl: null,
      testMode: isMollieTestMode(),
      notice: "Already paid — download PDF from the success page.",
    });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://siteflip.miqomilano.workers.dev"
  ).replace(/\/$/, "");
  const webhookUrl =
    process.env.MOLLIE_WEBHOOK_URL ||
    `${appUrl}/api/payments/mollie/webhook`;
  const redirectUrl = `${appUrl}/quote/success?id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.downloadToken)}`;

  let payment;
  try {
    payment = await createMolliePayment({
      amount: QUOTE_PDF_PRICE_EUR,
      currency: "EUR",
      description: `JIY Quote PDF — ${order.title}`.slice(0, 255),
      redirectUrl,
      webhookUrl,
      metadata: {
        purpose: QUOTE_PDF_PURPOSE,
        quoteId: order.id,
        unlockAmount: String(QUOTE_PDF_PRICE_EUR),
      },
    });
  } catch {
    return jsonError("Failed to create Mollie payment", 502);
  }

  await updateQuotePayment({
    id: order.id,
    status: "pending_payment",
    molliePaymentId: payment.id,
  });

  const checkoutUrl =
    payment.checkoutUrl || payment._links?.checkout?.href || null;

  return jsonOk({
    quoteId: order.id,
    paymentId: payment.id,
    checkoutUrl,
    status: payment.status,
    amount: QUOTE_PDF_PRICE_EUR,
    currency: "EUR",
    testMode: isMollieTestMode(),
    isEscrow: false,
    notice:
      "€1 unlocks PDF download only. Mollie is not escrow. Not e-sign.",
  });
}

export async function GET() {
  await ensureCloudflareEnv();
  return jsonOk({
    product: "JIY Quote",
    unlockAmount: QUOTE_PDF_PRICE_EUR,
    currency: "EUR",
    purpose: QUOTE_PDF_PURPOSE,
    configured: isMollieConfigured(),
    testMode: isMollieConfigured() ? isMollieTestMode() : null,
    paymentsEnabled: canCreateMolliePayments(),
    isEscrow: false,
    authRequired: false,
    endpoints: {
      draft: "/api/quote/draft",
      checkout: "/api/quote/checkout",
      status: "/api/quote/[id]/status",
      pdf: "/api/quote/[id]/pdf",
    },
  });
}
