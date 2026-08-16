import {
  businessPlanSchema,
  type BusinessPlan,
  type FactoryBriefInput,
} from "../schemas";
import { runStructuredAgent, slugifyName } from "./base";

export async function runBusinessAgent(brief: FactoryBriefInput) {
  return runStructuredAgent({
    system: `You are SITEFLIP BusinessAgent. Return a realistic MVP business blueprint as JSON matching the schema.
Include: businessName, businessDescription, problem, targetCustomer, businessModel, revenueModel, valueProposition, mainCompetitors, keyRisks, growthOpportunities.
Label assumptions. Never invent verified revenue or market statistics.
Classify any factual-sounding claims carefully — prefer AI_HYPOTHESIS unless user-provided.`,
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

  const businessModel =
    brief.businessModel ||
    `${brief.businessType} subscription for ${brief.targetCustomer}`;

  return {
    businessName,
    businessDescription: `${businessName} is a focused ${brief.businessType} for ${brief.targetCustomer} in ${brief.country}. Idea: ${brief.idea.slice(0, 180)}`,
    businessModel,
    targetCustomer: brief.targetCustomer,
    problem: `Operators in ${brief.country} lack a simple tool for: ${brief.idea.slice(0, 120)}`,
    solution: `A focused ${brief.businessType} MVP that solves one painful workflow end-to-end within budget ${brief.budget}.`,
    valueProposition: `Help ${brief.targetCustomer} get results faster with a narrow, practical MVP — not an overbuilt suite.`,
    revenueModel: "Monthly SaaS subscription with free trial (estimate)",
    mainCompetitors: [
      "Category incumbents (generalist tools)",
      "Spreadsheet / manual workflows",
      "Local agencies offering bespoke builds",
    ],
    growthOpportunities: [
      `Niche community launch in ${brief.country}`,
      "SEO around the core problem",
      "Partner with local service providers",
    ],
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
      "Payments architecture (not activated)",
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
    keyRisks: [
      "Unvalidated willingness to pay",
      "Execution complexity vs available time",
      "Competition from generalist tools",
    ],
    labeledAssumptions: [
      `[USER_PROVIDED] Idea, budget ${brief.budget}, target ${brief.targetRevenue}, country ${brief.country}`,
      "[AI_HYPOTHESIS] Revenue model and pricing tiers are estimates — not forecasts",
      "No real-time market data was queried",
      `Name "${businessName}" / domain suggestions are not availability-checked`,
      `Slug candidate: ${slugifyName(businessName)}`,
    ],
    claims: [
      {
        statement: `Target customer: ${brief.targetCustomer}`,
        claimClass: "USER_PROVIDED",
      },
      {
        statement: "Category has unmet demand for a simpler product",
        claimClass: "AI_HYPOTHESIS",
      },
    ],
  };
}
