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
      "[VERIFIED] Preview is rendered inside SITEFLIP — not a separate production host until approved",
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
    seoSuggestions: [
      "Publish one problem-focused landing section per week",
      "Target long-tail local keywords (hypothesis until validated)",
      "Add FAQ structured data after legal review",
    ],
    conversionSuggestions: [
      "Single primary CTA above the fold",
      "Reduce form fields on waitlist",
      "Show pricing clarity without fake social proof",
    ],
    productImprovements: [
      "Ship the narrowest core workflow first",
      "Instrument activation events before paid acquisition",
      "Collect qualitative interviews from first 10 users",
    ],
    labeledAssumptions: [
      "[AI_HYPOTHESIS] 90-day plan is a template — adapt to real traction data",
      "[VERIFIED] Paid advertising and production changes require approval",
    ],
  });
  return { data, source: "heuristic" as const, assumptions: data.labeledAssumptions };
}

export async function runFinanceAgent(plan: BusinessPlan, aiCostEur: number) {
  const starterPrice = plan.pricing.tiers[0]?.priceMonthlyEur ?? 19;
  const infra = 1.5;
  const thirdParty = 0;
  const data: FinanceEstimate = financeEstimateSchema.parse({
    estimatedAiCostEur: Math.round(aiCostEur * 100) / 100,
    estimatedInfraMonthlyEur: infra,
    estimatedThirdPartyMonthlyEur: thirdParty,
    developmentComplexity: "medium",
    monthlyOperatingEstimateEur: Math.round((infra + thirdParty) * 100) / 100,
    businessValueEstimateEur: null,
    valueEstimateNote:
      "No revenue yet — business value estimate unavailable. AI valuation requires operating metrics and is informational only.",
    labeledAssumptions: [
      `[AI_HYPOTHESIS] Starter list price €${starterPrice}/mo is planned, not earned`,
      "[AI_HYPOTHESIS] Infrastructure estimate assumes hobby-tier hosting — not a verified quote",
      "[VERIFIED] Cost figures are estimates unless tied to live provider invoices",
    ],
  });
  return { data, source: "heuristic" as const, assumptions: data.labeledAssumptions };
}
