import {
  paymentSpecSchema,
  type BusinessPlan,
  type PaymentSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runPaymentAgent(plan: BusinessPlan) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP PaymentAgent. Return Mollie payment integration architecture JSON. activated=false. Never store cards. Mollie is a payment processor, not escrow. Do not mention other payment processors.",
    user: { plan },
    schema: paymentSpecSchema,
    heuristic: () => heuristicPayment(plan),
  });
}

function heuristicPayment(plan: BusinessPlan): PaymentSpec {
  return {
    products: plan.pricing.tiers.map((t) => ({
      name: t.name,
      description: t.features.join(", "),
    })),
    prices: plan.pricing.tiers.map((t) => ({
      product: t.name,
      amountEur: t.priceMonthlyEur,
      interval: "month",
    })),
    checkoutArchitecture: [
      "Create Mollie payment server-side",
      "Redirect to Mollie-hosted checkout",
      "Success/cancel URLs in sandbox app",
    ],
    customerPortalArchitecture: [
      "Mollie customer / subscription management endpoints (architecture only)",
      "Allow plan changes / cancel after activation approval",
    ],
    webhookHandlers: [
      "payment.paid",
      "payment.failed",
      "payment.expired",
      "subscription.updated (if used)",
    ],
    subscriptionStates: ["pending", "paid", "failed", "canceled"],
    activated: false,
    notes: [
      "Never store card details",
      "Never expose Mollie API keys",
      "Ordinary Mollie payments are NOT escrow",
      "SITEFLIP payment provider is Mollie",
      "Payment activation requires user approval",
    ],
    labeledAssumptions: [
      "Products/prices are architectural only until Mollie is connected",
      "activated=false",
      "[VERIFIED] SITEFLIP payment provider is Mollie",
    ],
  };
}
