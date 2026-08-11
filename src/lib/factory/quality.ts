import type { FactoryProject, FactoryQualityScore } from "./types";
import { getOutputByAgent } from "./store";

export function computeFactoryQuality(project: FactoryProject): FactoryQualityScore {
  const has = (agent: string) => Boolean(getOutputByAgent(project, agent));

  const businessClarity = has("BusinessAgent") ? 82 : 20;
  const marketFit = has("MarketAgent") ? 70 : 20;
  const ux = has("ContentAgent") || has("BrandAgent") ? 75 : 25;
  const technicalQuality = has("ArchitectureAgent") ? 78 : 20;
  const seo = has("SEOAgent") ? 72 : 15;
  const performance = has("TestingAgent") ? 68 : 30;
  const security = has("ArchitectureAgent") ? 74 : 25;
  const monetization = has("PaymentAgent") || has("BusinessAgent") ? 76 : 20;
  const mobileReadiness = has("ContentAgent") ? 70 : 30;

  const completenessParts = [
    has("BusinessAgent"),
    has("MarketAgent"),
    has("BrandAgent"),
    has("ProductAgent"),
    has("ArchitectureAgent"),
    has("ContentAgent"),
    has("SEOAgent"),
    has("DeveloperAgent"),
    has("TestingAgent"),
    has("DeploymentAgent"),
  ];
  const completeness = Math.round(
    (completenessParts.filter(Boolean).length / completenessParts.length) * 100
  );

  const code = getOutputByAgent(project, "DeveloperAgent");
  const completenessAdj =
    code?.data?.completeness === "landing_page_only"
      ? Math.min(completeness, 55)
      : completeness;

  const scores = [
    businessClarity,
    marketFit,
    ux,
    technicalQuality,
    seo,
    performance,
    security,
    monetization,
    mobileReadiness,
    completenessAdj,
  ];
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    overall,
    businessClarity,
    marketFit,
    ux,
    technicalQuality,
    seo,
    performance,
    security,
    monetization,
    mobileReadiness,
    completeness: completenessAdj,
  };
}

/** Rough token/cost estimates — labeled as estimates */
export function estimateAgentCost(agent: string): {
  tokens: number;
  costEur: number;
} {
  const table: Record<string, { tokens: number; costEur: number }> = {
    BusinessAgent: { tokens: 2500, costEur: 0.35 },
    MarketAgent: { tokens: 2200, costEur: 0.3 },
    BrandAgent: { tokens: 2000, costEur: 0.28 },
    ProductAgent: { tokens: 2800, costEur: 0.4 },
    ArchitectureAgent: { tokens: 2400, costEur: 0.32 },
    ContentAgent: { tokens: 3000, costEur: 0.42 },
    SEOAgent: { tokens: 1800, costEur: 0.22 },
    DatabaseAgent: { tokens: 1600, costEur: 0.2 },
    PaymentAgent: { tokens: 1400, costEur: 0.18 },
    DeveloperAgent: { tokens: 4500, costEur: 0.65 },
    TestingAgent: { tokens: 800, costEur: 0.08 },
    DeploymentAgent: { tokens: 600, costEur: 0.05 },
    GrowthAgent: { tokens: 1500, costEur: 0.2 },
    FinanceAgent: { tokens: 1000, costEur: 0.12 },
  };
  return table[agent] ?? { tokens: 1000, costEur: 0.15 };
}

export function estimateFullPipelineCost(): {
  aiCostEur: number;
  infraMonthlyEur: number;
  thirdPartyMonthlyEur: number;
} {
  const agents = Object.keys({
    BusinessAgent: 1,
    MarketAgent: 1,
    BrandAgent: 1,
    ProductAgent: 1,
    ArchitectureAgent: 1,
    ContentAgent: 1,
    SEOAgent: 1,
    DatabaseAgent: 1,
    PaymentAgent: 1,
    DeveloperAgent: 1,
    TestingAgent: 1,
    DeploymentAgent: 1,
    GrowthAgent: 1,
    FinanceAgent: 1,
  });
  const aiCostEur = agents.reduce((s, a) => s + estimateAgentCost(a).costEur, 0);
  return {
    aiCostEur: Math.round(aiCostEur * 100) / 100,
    infraMonthlyEur: 1.5,
    thirdPartyMonthlyEur: 0,
  };
}
