import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatusToPayment,
} from "@/lib/payments/mollie";
import { buildQuotePdf } from "@/lib/quote/pdf";
import { QUOTE_PDF_PURPOSE } from "@/lib/quote/types";
import {
  getQuoteById,
  updateQuotePayment,
  verifyDownloadToken,
} from "@/lib/quote/store";

export const runtime = "nodejs";

/**
 * PDF download — gated until Mollie payment is paid (server-verified).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const order = await getQuoteById(id);
  if (!order) {
    return Response.json({ error: "Quote not found" }, { status: 404 });
  }
  if (!verifyDownloadToken(order, token)) {
    return Response.json({ error: "Invalid download token" }, { status: 403 });
  }

  let paid = order.status === "paid";

  if (!paid && order.molliePaymentId && isMollieConfigured()) {
    try {
      const payment = await getMolliePayment(order.molliePaymentId);
      const mapped = mapMollieStatusToPayment(String(payment.status));
      const meta = payment.metadata || {};
      if (
        mapped === "paid" &&
        (meta.purpose === QUOTE_PDF_PURPOSE ||
          meta.quoteId === order.id ||
          !meta.purpose)
      ) {
        await updateQuotePayment({
          id: order.id,
          status: "paid",
          molliePaymentId: payment.id,
          paidAt: new Date().toISOString(),
        });
        paid = true;
      }
    } catch {
      // fall through
    }
  }

  if (!paid) {
    return Response.json(
      {
        error: "Payment required",
        status: order.status,
        notice: "Pay €1 via Mollie to unlock this PDF.",
      },
      { status: 402 }
    );
  }

  const fresh = (await getQuoteById(id)) || order;
  const bytes = await buildQuotePdf(fresh);
  const filename = `jiy-quote-${fresh.id}.pdf`;

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
