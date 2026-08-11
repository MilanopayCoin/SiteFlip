import {
  contentSchema,
  type BrandPlan,
  type BusinessPlan,
  type ContentPack,
  type ProductSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runContentAgent(
  plan: BusinessPlan,
  brand: BrandPlan,
  product: ProductSpec
) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP ContentAgent. Generate landing copy JSON based on approved business/brand/product specs.",
    user: { plan, brand, product },
    schema: contentSchema,
    heuristic: () => heuristicContent(plan, brand),
  });
}

function heuristicContent(plan: BusinessPlan, brand: BrandPlan): ContentPack {
  return {
    hero: {
      headline: brand.tagline,
      subheadline: brand.brandDescription,
      cta: "Start free",
    },
    features: plan.mvpScope.slice(0, 4).map((f) => ({
      title: f,
      body: `Included in the ${plan.businessName} MVP scope.`,
    })),
    benefits: [
      `Built for ${plan.targetCustomer}`,
      "Simple pricing",
      "Ship faster than building from scratch",
    ],
    pricingCopy: plan.pricing.tiers
      .map((t) => `${t.name}: €${t.priceMonthlyEur}/mo — ${t.features.join(", ")}`)
      .join(" · "),
    faq: [
      {
        q: "Is this a finished production SaaS?",
        a: "The factory MVP generates a blueprint and starter landing preview. Full product code requires further approved builds.",
      },
      {
        q: "Are payments live?",
        a: "Payment architecture is prepared. Activation requires your approval and Stripe keys.",
      },
    ],
    about: brand.brandDescription,
    contact: "Contact form placeholder — wire to your email provider.",
    termsPlaceholder:
      "Terms of Service placeholder — requires legal review before publishing.",
    privacyPlaceholder:
      "Privacy Policy placeholder — requires legal review before publishing.",
    seoMetadata: {
      title: `${brand.brandName} — ${brand.tagline}`,
      description: brand.brandDescription.slice(0, 155),
    },
    labeledAssumptions: [
      "Copy is AI-generated from specs — not user-approved until you approve",
      "Legal placeholders are not publishable legal documents",
    ],
  };
}
