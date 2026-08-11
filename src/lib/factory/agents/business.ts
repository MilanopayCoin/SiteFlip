import {
  businessPlanSchema,
  type BusinessPlan,
  type FactoryBriefInput,
} from "../schemas";
import { runStructuredAgent, slugifyName } from "./base";

export async function runBusinessAgent(brief: FactoryBriefInput) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP BusinessAgent. Return a realistic MVP business plan as JSON matching the schema. Label assumptions. Never invent verified revenue.",
    user: brief,
    schema: businessPlanSchema,
    heuristic: () => heuristicBusiness(brief),
  });
}

function heuristicBusiness(brief: FactoryBriefInput): BusinessPlan {
  const nameBits = brief.idea
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);
  const businessName =
    nameBits.length >= 1
      ? `${nameBits[0]!.charAt(0).toUpperCase()}${nameBits[0]!.slice(1)}${
          brief.businessType.toLowerCase().includes("saas") ? "Flow" : "Hub"
        }`
      : `${brief.businessType} Starter`;

  return {
    businessName,
    businessModel: `${brief.businessType} subscription for ${brief.targetCustomer}`,
    targetCustomer: brief.targetCustomer,
    problem: `Operators in ${brief.country} lack a simple tool for: ${brief.idea.slice(0, 120)}`,
    solution: `A focused ${brief.businessType} MVP that solves one painful workflow end-to-end within budget ${brief.budget}.`,
    revenueModel: "Monthly SaaS subscription with free trial",
    pricing: {
      tiers: [
        {
          name: "Starter",
          priceMonthlyEur: 19,
          features: ["Core workflow", "Email support", "1 seat"],
        },
        {
          name: "Pro",
          priceMonthlyEur: 49,
          features: ["Everything in Starter", "Automations", "5 seats"],
        },
      ],
    },
    mvpScope: [
      "Landing page + waitlist/auth",
      "Core create/list workflow",
      "Basic dashboard",
      "Stripe checkout architecture (not activated)",
      "SEO metadata",
    ],
    growthStrategy: [
      "Launch to niche communities in " + brief.country,
      "SEO content around core problem",
      "Onboarding emails",
      "Iterate on first 20 users",
    ],
    risks: [
      "Demand is an AI hypothesis until validated",
      `Budget ${brief.budget} may constrain feature depth`,
      "Payment activation requires user approval",
    ],
    labeledAssumptions: [
      `Revenue goal ${brief.targetRevenue} is aspirational — not a forecast`,
      "No real-time market data was queried",
      `Name "${businessName}" / domain suggestions are not availability-checked`,
      `Slug candidate: ${slugifyName(businessName)}`,
    ],
  };
}
