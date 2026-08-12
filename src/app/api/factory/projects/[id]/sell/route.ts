import { NextResponse } from "next/server";
import {
  getFactoryProject,
  getOutputByAgent,
  addApproval,
  appendActivity,
  saveFactoryProject,
} from "@/lib/factory/store";
import { buildBusinessPassport } from "@/lib/factory/passport";
import { computeValuation } from "@/lib/ai";
import { VALUATION_DISCLAIMER } from "@/lib/utils";
import type { BusinessPlan, BrandPlan, ProductSpec } from "@/lib/factory/schemas";

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
  const brand = getOutputByAgent(project, "BrandAgent")?.data as
    | BrandPlan
    | undefined;
  const product = getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;

  const valuation = computeValuation({
    category: project.brief.businessType.toLowerCase().includes("saas")
      ? "saas"
      : "web_apps",
    monthlyRevenue: 0,
    monthlyProfit: 0,
    monthlyTraffic: 0,
    growthRate: 0,
  });

  const passport = project.passport ?? buildBusinessPassport(project);
  project.passport = passport;

  const listingDraft = {
    title: plan?.businessName || project.name,
    summary:
      plan?.businessDescription ||
      brand?.brandDescription ||
      `${project.name} — factory-generated early-stage digital business.`,
    description: [
      plan?.valueProposition,
      plan?.solution,
      product?.coreProduct,
      `Target customer: ${plan?.targetCustomer || project.brief.targetCustomer}`,
      `Revenue model: ${plan?.revenueModel || "Not specified"}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    listingType: "SELL" as const,
    suggestedAskingPriceRange: {
      minEur: valuation.minimum_value,
      maxEur: valuation.maximum_value,
      estimateEur: valuation.estimated_value,
      note: "AI valuation estimate only — zero operating revenue assumed. User must approve before publishing.",
    },
    aiScore: project.quality?.overall ?? null,
    businessPassportPath: `/build/${project.id}/passport`,
  };

  // Require explicit publish approval — never auto-publish
  const existing = project.approvals.find(
    (a) => a.action === "publish_listing" && a.status === "PENDING"
  );
  if (!existing) {
    addApproval(project, {
      projectId: project.id,
      action: "publish_listing",
      title: "Publish marketplace listing",
      explanation:
        "Listing draft is ready. Publishing to SITEFLIP marketplace requires your explicit approval. AI valuation is an estimate only.",
      services: ["SITEFLIP marketplace"],
      estimatedCostEur: 0,
      risks: ["Listing without traction or verified metrics"],
    });
  }
  appendActivity(
    project,
    "Orchestrator",
    "BUILD → SELL listing draft prepared (not published)",
    "info"
  );
  saveFactoryProject(project);

  return NextResponse.json({
    saleReadinessScore: project.state === "LIVE" ? 35 : 20,
    suggestedValuation: valuation,
    listingDraft,
    listingDescription: listingDraft.summary,
    businessPassportPath: listingDraft.businessPassportPath,
    aiScore: listingDraft.aiScore,
    risks: plan?.keyRisks ?? plan?.risks ?? ["Early-stage asset"],
    recommendedImprovements: [
      "Acquire first paying customers",
      "Verify domain ownership",
      "Activate payments with approval",
      "Add 30 days of metrics history",
    ],
    listOnSiteflipPath: `/sell?fromFactory=${project.id}`,
    disclaimer: VALUATION_DISCLAIMER,
    assumptions: [
      "Valuation uses zero operating revenue — estimate reflects early-stage heuristics only",
      "No fabricated customers, traffic, or revenue",
      "Listing is NOT published until publish_listing approval",
      passport.persistenceNote,
    ],
    persistenceMode: project.persistenceMode,
  });
}
