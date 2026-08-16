import type { FactoryProject, FactoryQualityScore } from "./types";
import { getOutputByAgent } from "./store";
import type { ArchitectureSpec, BusinessPlan, MarketAnalysis } from "./schemas";

/**
 * AI Score 0–100 based on factory outputs only.
 * Never fabricates external market statistics.
 */
export function computeFactoryQuality(project: FactoryProject): FactoryQualityScore {
  const isV3 =
    project.pipelineVersion === "v3" ||
    project.pipelineVersion === "v4" ||
    project.pipelineVersion === "v5";
  const planAgent = isV3 ? "PlannerAgent" : "BusinessAgent";
  const has = (agent: string) => Boolean(getOutputByAgent(project, agent));
  const plan = getOutputByAgent(project, planAgent)?.data as
    | BusinessPlan
    | undefined;
  const market = getOutputByAgent(project, "MarketAgent")?.data as
    | MarketAnalysis
    | undefined;
  const arch = getOutputByAgent(project, "ArchitectureAgent")?.data as
    | ArchitectureSpec
    | undefined;
  const explanations: string[] = [];

  const marketClarity = clamp(
    (has("MarketAgent") ? 55 : 15) +
      (market?.customerSegments?.length ? 15 : 0) +
      (market?.claims?.some((c) => c.claimClass === "USER_PROVIDED") ? 15 : 0) +
      (project.brief.country && project.brief.targetCustomer ? 10 : 0)
  );
  explanations.push(
    `Market clarity ${marketClarity}: based on brief + MarketAgent output presence — not live market data.`
  );

  const problemStrength = clamp(
    (plan?.problem ? 40 : 10) +
      (plan?.valueProposition ? 25 : 0) +
      (plan?.solution ? 20 : 0) +
      (has("ProductAgent") ? 10 : 0)
  );
  explanations.push(
    `Problem strength ${problemStrength}: derived from blueprint problem/solution/value proposition text.`
  );

  const businessModelScore = clamp(
    (plan?.businessModel ? 35 : 10) +
      (plan?.revenueModel ? 25 : 0) +
      (plan?.pricing?.tiers?.length ? 25 : 0) +
      (has("PaymentAgent") ? 10 : 0)
  );
  explanations.push(
    `Business model ${businessModelScore}: from stated model/pricing architecture (planned, not earned).`
  );

  const competition = clamp(
    (plan?.mainCompetitors?.length ? 40 : 15) +
      (market?.competitivePositioning?.length ? 25 : 0) +
      (market?.competitorCategories?.length ? 20 : 0)
  );
  explanations.push(
    `Competition ${competition}: based on listed competitor categories — AI_HYPOTHESIS unless user-provided.`
  );

  const complexityMap = { low: 80, medium: 55, high: 30 } as const;
  const executionComplexity = clamp(
    arch?.estimatedComplexity
      ? complexityMap[arch.estimatedComplexity]
      : has("ArchitectureAgent")
        ? 50
        : 25
  );
  explanations.push(
    `Execution complexity ${executionComplexity}: inverted score from architecture estimate (${arch?.estimatedComplexity ?? "unknown"}).`
  );

  const growthPotential = clamp(
    (plan?.growthOpportunities?.length ? 35 : 15) +
      (has("GrowthAgent") ? 25 : 0) +
      (has("SEOAgent") ? 20 : 0) +
      (market?.opportunities?.length ? 15 : 0)
  );
  explanations.push(
    `Growth potential ${growthPotential}: from growth/SEO outputs — template recommendations, not forecasts.`
  );

  const riskCount =
    (plan?.keyRisks?.length ?? 0) + (market?.marketRisks?.length ?? 0);
  const risk = clamp(
    85 - Math.min(50, riskCount * 8) + (has("SecurityAgent") ? 10 : 0)
  );
  explanations.push(
    `Risk ${risk}: higher when more risks listed; SecurityAgent presence improves score slightly.`
  );

  const businessClarity = clamp(
    (plan?.businessDescription || (plan as { summary?: string })?.summary ? 40 : 15) +
      (has(planAgent) ? 40 : 0)
  );
  const marketFit = marketClarity;
  const ux =
    has("ContentAgent") || has("BrandAgent") || (isV3 && has("DeveloperAgent"))
      ? 75
      : 25;
  const technicalQuality = has("ArchitectureAgent") ? 78 : 20;
  const seo = has("SEOAgent") ? 72 : 15;
  const performance = has("TestingAgent") ? 68 : 30;
  const security = has("SecurityAgent") ? 80 : has("ArchitectureAgent") ? 60 : 25;
  const monetization = businessModelScore;
  const mobileReadiness = has("ContentAgent") ? 70 : 30;

  const completenessParts = isV3
    ? [
        has("PlannerAgent"),
        has("ProductAgent"),
        has("DatabaseAgent"),
        has("ArchitectureAgent"),
        has("DeveloperAgent"),
        has("TestingAgent"),
        has("SecurityAgent"),
        has("DeploymentAgent"),
      ]
    : [
        has("BusinessAgent"),
        has("MarketAgent"),
        has("BrandAgent"),
        has("ProductAgent"),
        has("ArchitectureAgent"),
        has("SecurityAgent"),
        has("ContentAgent"),
        has("DeveloperAgent"),
        has("TestingAgent"),
        has("DeploymentAgent"),
      ];
  let completeness = Math.round(
    (completenessParts.filter(Boolean).length / completenessParts.length) * 100
  );
  const code = getOutputByAgent(project, "DeveloperAgent");
  if (code?.data?.completeness === "landing_page_only") {
    completeness = Math.min(completeness, 55);
    explanations.push(
      "Completeness capped: DeveloperAgent produced landing_page_only (not a full SaaS)."
    );
  }
  if (code?.data?.completeness === "starter_mvp_scaffold") {
    completeness = Math.min(completeness, 78);
    explanations.push(
      "Completeness capped at 78: starter_mvp_scaffold — AI GENERATED STARTER, not production SaaS."
    );
  }

  const core = [
    marketClarity,
    problemStrength,
    businessModelScore,
    competition,
    executionComplexity,
    growthPotential,
    risk,
  ];
  const overall = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
  explanations.push(
    `Overall ${overall}/100 = average of market clarity, problem strength, business model, competition, execution complexity, growth potential, and risk.`
  );
  explanations.push(
    "No external verified market statistics were used for this score."
  );

  return {
    overall,
    marketClarity,
    problemStrength,
    businessModel: businessModelScore,
    competition,
    executionComplexity,
    growthPotential,
    risk,
    businessClarity,
    marketFit,
    ux,
    technicalQuality,
    seo,
    performance,
    security,
    monetization,
    mobileReadiness,
    completeness,
    explanations,
  };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Rough token/cost estimates — labeled as estimates */
export function estimateAgentCost(agent: string): {
  tokens: number;
  costEur: number;
} {
  const table: Record<string, { tokens: number; costEur: number }> = {
    PlannerAgent: { tokens: 2200, costEur: 0.3 },
    BusinessAgent: { tokens: 2500, costEur: 0.35 },
    MarketAgent: { tokens: 2200, costEur: 0.3 },
    BrandAgent: { tokens: 2000, costEur: 0.28 },
    ProductAgent: { tokens: 2800, costEur: 0.4 },
    ArchitectureAgent: { tokens: 2400, costEur: 0.32 },
    SecurityAgent: { tokens: 1200, costEur: 0.15 },
    ContentAgent: { tokens: 3000, costEur: 0.42 },
    SEOAgent: { tokens: 1800, costEur: 0.22 },
    DatabaseAgent: { tokens: 1600, costEur: 0.2 },
    PaymentAgent: { tokens: 1400, costEur: 0.18 },
    DeveloperAgent: { tokens: 4500, costEur: 0.65 },
    TestingAgent: { tokens: 800, costEur: 0.08 },
    DeploymentAgent: { tokens: 600, costEur: 0.05 },
    GrowthAgent: { tokens: 1500, costEur: 0.2 },
    FinanceAgent: { tokens: 1000, costEur: 0.12 },
    PassportAgent: { tokens: 200, costEur: 0.02 },
    ScoreAgent: { tokens: 200, costEur: 0.02 },
  };
  return table[agent] ?? { tokens: 1000, costEur: 0.15 };
}

export function estimateV3PipelineCost(): {
  aiCostEur: number;
  infraMonthlyEur: number;
  thirdPartyMonthlyEur: number;
} {
  const agents = [
    "PlannerAgent",
    "ProductAgent",
    "DatabaseAgent",
    "ArchitectureAgent",
    "DeveloperAgent",
    "TestingAgent",
    "SecurityAgent",
    "DeploymentAgent",
    "GrowthAgent",
    "FinanceAgent",
  ];
  const aiCostEur = agents.reduce((s, a) => s + estimateAgentCost(a).costEur, 0);
  return {
    aiCostEur: Math.round(aiCostEur * 100) / 100,
    infraMonthlyEur: 2.5,
    thirdPartyMonthlyEur: 0,
  };
}

export function estimateFullPipelineCost(): {
  aiCostEur: number;
  infraMonthlyEur: number;
  thirdPartyMonthlyEur: number;
} {
  const agents = [
    "BusinessAgent",
    "MarketAgent",
    "BrandAgent",
    "ProductAgent",
    "ArchitectureAgent",
    "SecurityAgent",
    "ContentAgent",
    "SEOAgent",
    "DatabaseAgent",
    "PaymentAgent",
    "DeveloperAgent",
    "TestingAgent",
    "DeploymentAgent",
    "GrowthAgent",
    "FinanceAgent",
  ];
  const aiCostEur = agents.reduce((s, a) => s + estimateAgentCost(a).costEur, 0);
  return {
    aiCostEur: Math.round(aiCostEur * 100) / 100,
    infraMonthlyEur: 1.5,
    thirdPartyMonthlyEur: 0,
  };
}
