import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";

/**
 * Stripe webhook stub.
 *
 * IMPORTANT: Stripe payment events are NOT escrow.
 * SITEFLIP marketplace transactions require a separate escrow / legal workflow.
 * A successful Stripe payment does not automatically transfer business ownership.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (webhookSecret) {
    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_stub");
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

      return NextResponse.json({
        received: true,
        type: event.type,
        id: event.id,
        disclaimer:
          "Stripe payment confirmation is not escrow. Ownership transfer requires SITEFLIP transaction workflow.",
      });
    } catch (error) {
      console.error("[api/webhooks/stripe] signature verification failed", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // Demo / dev mode without webhook secret configured
  let payload: unknown = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = { raw: body.slice(0, 200) };
  }

  return NextResponse.json({
    received: true,
    mode: "stub",
    payload,
    disclaimer:
      "Stripe payment events are not escrow. Configure STRIPE_WEBHOOK_SECRET for signature verification in production.",
  });
}
