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
import type { FactoryProject } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  let project = getFactoryProject(id);
  const incoming = (body as { project?: FactoryProject })?.project;
  if (!project && incoming && incoming.id === id && incoming.persistenceMode !== "SUPABASE") {
    project = saveFactoryProject(incoming);
  }
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = getOutputByAgent(project, "BusinessAgent")?.data as
    | BusinessPlan
    | undefined;
  const planV3 = getOutputByAgent(project, "PlannerAgent")?.data as
    | { businessName?: string; summary?: string; solution?: string; targetCustomer?: string; revenueModel?: string; pricing?: BusinessPlan["pricing"] }
    | undefined;
  const brand = getOutputByAgent(project, "BrandAgent")?.data as
    | BrandPlan
    | undefined;
  const product = getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;

  const effectivePlan = plan ?? (planV3 ? {
    businessName: planV3.businessName,
    businessDescription: planV3.summary,
    valueProposition: planV3.summary,
    solution: planV3.solution,
    targetCustomer: planV3.targetCustomer,
    revenueModel: planV3.revenueModel,
    pricing: planV3.pricing,
  } : undefined);

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

  const marketplaceStatus =
    project.state === "LIVE" && project.sandbox.productionUrl
      ? "LIVE"
      : project.sandbox.previewUrl || project.sandbox.deploymentStatus === "READY"
        ? "PREVIEW"
        : "DRAFT";

  const listingDraft = {
    title: effectivePlan?.businessName || project.name,
    summary:
      effectivePlan?.businessDescription ||
      brand?.brandDescription ||
      `${project.name} — factory-generated ${project.pipelineVersion === "v3" || project.pipelineVersion === "v4" ? "starter mini-SaaS" : "early-stage digital business"}.`,
    description: [
      effectivePlan?.valueProposition,
      effectivePlan?.solution,
      product?.coreProduct,
      `Target customer: ${effectivePlan?.targetCustomer || project.brief.targetCustomer}`,
      `Revenue model: ${effectivePlan?.revenueModel || "Not specified"}`,
      project.pipelineVersion === "v3" || project.pipelineVersion === "v4"
        ? "Technology: Next.js starter MVP scaffold (AI GENERATED STARTER)"
        : undefined,
    ]
      .filter(Boolean)
      .join("\n\n"),
    listingType: "SELL" as const,
    marketplaceStatus,
    prepareForSale: marketplaceStatus === "LIVE",
    suggestedAskingPriceRange: {
      minEur: valuation.minimum_value,
      maxEur: valuation.maximum_value,
      estimateEur: valuation.estimated_value,
      note: "AI ESTIMATE — zero operating revenue assumed. User must approve before publishing. Never a guaranteed valuation.",
    },
    features: product?.mvpFeatures ?? [],
    technology: project.passport?.technology ?? [],
    businessPassport: passport,
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
        "Listing draft is ready. Publishing to JIY.APP marketplace requires your explicit approval. AI valuation is an estimate only.",
      services: ["JIY.APP marketplace"],
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
    risks: (effectivePlan as BusinessPlan)?.keyRisks ?? (effectivePlan as BusinessPlan)?.risks ?? ["Early-stage asset"],
    recommendedImprovements: [
      "Acquire first paying customers",
      "Verify domain ownership",
      "Activate payments with approval",
      "Add 30 days of metrics history",
    ],
    listOnSiteflipPath: `/sell?fromFactory=${project.id}`,
    marketplaceStatus,
    disclaimer: VALUATION_DISCLAIMER,
    assumptions: [
      "AI ESTIMATE — valuation uses zero operating revenue",
      "No fabricated customers, traffic, or revenue",
      `Marketplace status: ${marketplaceStatus} — LIVE only after verified production deployment`,
      "Listing is NOT published until publish_listing approval",
      passport.persistenceNote,
    ],
    persistenceMode: project.persistenceMode,
  });
}
