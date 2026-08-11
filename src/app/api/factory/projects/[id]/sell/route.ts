import { NextResponse } from "next/server";
import { getFactoryProject, getOutputByAgent } from "@/lib/factory/store";
import { computeValuation } from "@/lib/ai";
import { VALUATION_DISCLAIMER } from "@/lib/utils";
import type { BusinessPlan } from "@/lib/factory/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = getOutputByAgent(project, "BusinessAgent")?.data as
    | BusinessPlan
    | undefined;

  // New builds have no real revenue — do not fabricate
  const valuation = computeValuation({
    category: project.brief.businessType.toLowerCase().includes("saas")
      ? "saas"
      : "web_apps",
    monthlyRevenue: 0,
    monthlyProfit: 0,
    monthlyTraffic: 0,
    growthRate: 0,
  });

  const readiness = {
    score: project.state === "LIVE" ? 35 : 20,
    reasons: [
      "No verified revenue yet",
      "No verified traffic yet",
      project.state === "LIVE"
        ? "Marked live in sandbox"
        : "Not live — list after traction",
      `Code completeness: ${(getOutputByAgent(project, "DeveloperAgent")?.data as { completeness?: string })?.completeness ?? "unknown"}`,
    ],
    recommendedImprovements: [
      "Acquire first paying customers",
      "Verify domain ownership",
      "Activate payments with approval",
      "Add 30 days of metrics history",
    ],
  };

  return NextResponse.json({
    saleReadinessScore: readiness.score,
    suggestedValuation: valuation,
    listingDescription: plan
      ? `${plan.businessName} — ${plan.businessModel}. ${plan.solution}`
      : project.name,
    businessPassportPath: `/passport/${project.id}`,
    risks: plan?.risks ?? ["Early-stage asset"],
    recommendedImprovements: readiness.recommendedImprovements,
    listOnSiteflipPath: `/sell?fromFactory=${project.id}`,
    disclaimer: VALUATION_DISCLAIMER,
    assumptions: [
      "Valuation uses zero operating revenue — estimate reflects early-stage heuristics only",
      "No fabricated customers, traffic, or revenue",
    ],
  });
}
