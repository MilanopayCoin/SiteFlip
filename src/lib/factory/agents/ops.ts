import {
  deploymentSchema,
  growthPlanSchema,
  financeEstimateSchema,
  type DeploymentSpec,
  type FinanceEstimate,
  type GrowthPlan,
  type BusinessPlan,
} from "../schemas";
import { previewPathFor } from "../sandbox";

export async function runDeploymentAgent(projectId: string, testsPassed: boolean) {
  const data: DeploymentSpec = deploymentSchema.parse({
    status: testsPassed ? "READY" : "FAILED",
    previewReady: testsPassed,
    previewPath: testsPassed ? previewPathFor(projectId) : null,
    productionApproved: false,
    productionLive: false,
    vercelCompatible: true,
    notes: [
      "Preview environment architecture ready",
      "Production deployment requires explicit user approval",
      "Deployment credentials are never exposed",
    ],
    labeledAssumptions: [
      "Preview is rendered inside SITEFLIP — not a separate Vercel project until connected",
    ],
  });
  return { data, source: "heuristic" as const, assumptions: data.labeledAssumptions };
}

export async function runGrowthAgent(plan: BusinessPlan) {
  const themes = [
    "SEO foundation",
    "Launch campaign",
    "Content engine",
    "Customer acquisition",
    "Onboarding polish",
    "Referral experiments",
    "Pricing tests",
    "Partnership outreach",
    "Retention loops",
    "Case studies",
    "Paid experiments (approval required)",
    "Sale/rent readiness review",
  ];
  const weeks = themes.map((title, i) => ({
    week: i + 1,
    title,
    actions: [
      `Execute: ${title}`,
      `Measure: weekly KPI for ${plan.businessName}`,
      "Log learnings in Business Memory",
    ],
  }));

  const data: GrowthPlan = growthPlanSchema.parse({
    weeks,
    labeledAssumptions: [
      "90-day plan is a template — adapt to real traction data",
      "Paid advertising requires approval",
    ],
  });
  return { data, source: "heuristic" as const, assumptions: data.labeledAssumptions };
}

export async function runFinanceAgent(plan: BusinessPlan, aiCostEur: number) {
  const starterPrice = plan.pricing.tiers[0]?.priceMonthlyEur ?? 19;
  const data: FinanceEstimate = financeEstimateSchema.parse({
    estimatedAiCostEur: Math.round(aiCostEur * 100) / 100,
    estimatedInfraMonthlyEur: 1.5,
    estimatedThirdPartyMonthlyEur: 0,
    businessValueEstimateEur: null,
    valueEstimateNote:
      "No revenue yet — business value estimate unavailable. AI valuation requires operating metrics and is informational only.",
    labeledAssumptions: [
      `Starter list price €${starterPrice}/mo is planned, not earned`,
      "Infrastructure estimate assumes hobby-tier hosting",
    ],
  });
  return { data, source: "heuristic" as const, assumptions: data.labeledAssumptions };
}
