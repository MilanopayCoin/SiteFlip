import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import {
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatusToPayment,
} from "@/lib/payments/mollie";
import {
  QUOTE_PDF_PURPOSE,
  publicQuoteView,
  type QuoteStatus,
} from "@/lib/quote/types";
import {
  getQuoteById,
  updateQuotePayment,
  verifyDownloadToken,
} from "@/lib/quote/store";

export const runtime = "nodejs";

function mapToQuoteStatus(
  mapped: ReturnType<typeof mapMollieStatusToPayment>
): QuoteStatus {
  switch (mapped) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "pending_payment";
  }
}

/**
 * Quote status. When token matches and Mollie is configured, re-fetches
 * payment server-side (never trust browser redirect alone).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const sync = url.searchParams.get("sync") !== "0";

  const order = await getQuoteById(id);
  if (!order) return jsonError("Quote not found", 404);
  if (!verifyDownloadToken(order, token)) {
    return jsonError("Invalid download token", 403);
  }

  let verifiedFromMollie: string | null = null;

  if (
    sync &&
    order.status !== "paid" &&
    order.molliePaymentId &&
    isMollieConfigured()
  ) {
    try {
      const payment = await getMolliePayment(order.molliePaymentId);
      const mapped = mapMollieStatusToPayment(String(payment.status));
      verifiedFromMollie = mapped;
      const meta = payment.metadata || {};
      if (
        meta.purpose === QUOTE_PDF_PURPOSE ||
        meta.quoteId === order.id ||
        !meta.purpose
      ) {
        const next = mapToQuoteStatus(mapped);
        const updated = await updateQuotePayment({
          id: order.id,
          status: next,
          molliePaymentId: payment.id,
          paidAt: next === "paid" ? new Date().toISOString() : null,
        });
        if (updated) {
          return jsonOk({
            quote: publicQuoteView(updated),
            verifiedFromMollie,
            downloadReady: updated.status === "paid",
            isEscrow: false,
          });
        }
      }
    } catch {
      // Keep stored status if Mollie unreachable
    }
  }

  return jsonOk({
    quote: publicQuoteView(order),
    verifiedFromMollie,
    downloadReady: order.status === "paid",
    isEscrow: false,
  });
}
