import {
  paymentSpecSchema,
  type BusinessPlan,
  type PaymentSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runPaymentAgent(plan: BusinessPlan) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP PaymentAgent. Return Stripe integration architecture JSON. activated=false. Never store cards. Never call Stripe escrow.",
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
      "Create Checkout Session server-side",
      "Redirect to Stripe-hosted checkout",
      "Success/cancel URLs in sandbox app",
    ],
    customerPortalArchitecture: [
      "Stripe Customer Portal session endpoint",
      "Allow plan changes / cancel",
    ],
    webhookHandlers: [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ],
    subscriptionStates: ["trialing", "active", "past_due", "canceled"],
    activated: false,
    notes: [
      "Never store card details",
      "Never expose Stripe secret keys",
      "Ordinary Stripe payments are NOT escrow",
      "Payment activation requires user approval",
    ],
    labeledAssumptions: [
      "Products/prices are architectural only until Stripe is connected",
      "activated=false",
    ],
  };
}
