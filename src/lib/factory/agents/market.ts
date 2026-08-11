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
    system:
      "You are SITEFLIP MarketAgent. Analyze market as JSON. Never claim real-time market data unless an external API is connected. Separate aiHypotheses, verifiedResearch, userProvided.",
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
    competitorCategories: [
      `${brief.businessType} incumbents`,
      "Spreadsheet / manual workflows",
      "Generalist productivity tools",
    ],
    customerPainPoints: [
      "Too much manual work",
      "Tools are overbuilt or expensive",
      "Local language / compliance friction",
    ],
    pricingOpportunities: [
      `Entry tier near €${plan.pricing.tiers[0]?.priceMonthlyEur ?? 19}/mo`,
      "Annual discount for SMBs",
    ],
    differentiation: [
      `Focused on ${brief.country} / ${brief.targetCustomer}`,
      "Narrow MVP scope for speed",
      plan.solution.slice(0, 80),
    ],
    marketRisks: [
      "Crowded category (hypothesis)",
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
  };
}
