import {
  marketAnalysisSchema,
  type FactoryBriefInput,
  type MarketAnalysis,
  type BusinessPlan,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runMarketAgent(
  brief: FactoryBriefInput,
  plan: BusinessPlan
) {
  return runStructuredAgent({
    system: `You are SITEFLIP MarketAgent. Analyze market as JSON.
Never fabricate verified market statistics.
Every factual statement must be classified VERIFIED, USER_PROVIDED, or AI_HYPOTHESIS.
If real-time research is unavailable, put hypotheses in aiHypotheses/claims with AI_HYPOTHESIS and leave verifiedResearch empty (or state that no external research API was connected).`,
    user: { brief, plan },
    schema: marketAnalysisSchema,
    heuristic: () => heuristicMarket(brief, plan),
  });
}

function heuristicMarket(
  brief: FactoryBriefInput,
  plan: BusinessPlan
): MarketAnalysis {
  return {
    targetMarket: `${brief.targetCustomer} in ${brief.country}`,
    customerSegments: [
      brief.targetCustomer,
      `Early adopters in ${brief.country}`,
      "Operators replacing spreadsheets",
    ],
    marketAssumptions: [
      {
        statement: "A simpler niche tool can win onboarding against generalists",
        claimClass: "AI_HYPOTHESIS",
      },
      {
        statement: `User budget constraint: ${brief.budget}`,
        claimClass: "USER_PROVIDED",
      },
    ],
    competitorCategories: [
      `${brief.businessType} incumbents`,
      "Spreadsheet / manual workflows",
      "Generalist productivity tools",
    ],
    competitivePositioning: [
      `Narrow focus on ${brief.country} / ${brief.targetCustomer}`,
      "Faster time-to-value than enterprise suites",
      plan.valueProposition.slice(0, 120),
    ],
    customerPainPoints: [
      "Too much manual work",
      "Tools are overbuilt or expensive",
      "Local language / compliance friction",
    ],
    pricingOpportunities: [
      `Entry tier near €${plan.pricing.tiers[0]?.priceMonthlyEur ?? 19}/mo (estimate)`,
      "Annual discount for SMBs (hypothesis)",
    ],
    differentiation: [
      `Focused on ${brief.country} / ${brief.targetCustomer}`,
      "Narrow MVP scope for speed",
      plan.solution.slice(0, 80),
    ],
    opportunities: plan.growthOpportunities,
    marketRisks: [
      "Crowded category (AI_HYPOTHESIS)",
      "Willingness to pay unvalidated",
      "Channel access unknown",
    ],
    aiHypotheses: [
      "Category has unmet demand for a simpler product",
      "Local positioning improves conversion",
      "SEO can acquire early customers within 90 days",
    ],
    verifiedResearch: [
      "No external search/data API connected in this run — verifiedResearch is empty by design",
    ],
    userProvided: [
      `Idea: ${brief.idea}`,
      `Budget: ${brief.budget}`,
      `Target revenue: ${brief.targetRevenue}`,
      `Country: ${brief.country}`,
      `Customer: ${brief.targetCustomer}`,
    ],
    claims: [
      {
        statement: `Target market described as ${brief.targetCustomer} in ${brief.country}`,
        claimClass: "USER_PROVIDED",
      },
      {
        statement: "No live market data provider was queried for this analysis",
        claimClass: "VERIFIED",
      },
      {
        statement: "Local niche positioning can outperform generalist tools",
        claimClass: "AI_HYPOTHESIS",
      },
    ],
  };
}
