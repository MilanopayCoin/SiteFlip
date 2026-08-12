import { NextResponse } from "next/server";
import { getFactoryProject, getOutputByAgent } from "@/lib/factory/store";
import type { CodeArtifact, ContentPack, BrandPlan } from "@/lib/factory/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const code = getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const content = getOutputByAgent(project, "ContentAgent")?.data as
    | ContentPack
    | undefined;
  const brand = getOutputByAgent(project, "BrandAgent")?.data as
    | BrandPlan
    | undefined;
  const tests = getOutputByAgent(project, "TestingAgent");

  return NextResponse.json({
    previewReady: Boolean(code && project.sandbox.deploymentStatus !== "NOT_STARTED"),
    url: `/build/${id}/preview`,
    label: "SANDBOX PREVIEW",
    sandboxPreview: true,
    isolationLabel: project.sandbox.isolationLabel || "SANDBOX: DEVELOPMENT ISOLATION",
    isProductionGrade: Boolean(project.sandbox.isProductionGrade),
    sandboxId: project.sandbox.sandboxId || null,
    runtimeId: project.sandbox.runtimeId || null,
    businessId: project.sandbox.businessId || project.id,
    sandboxLifecycle: project.sandbox.lifecycle || null,
    buildStatus: (() => {
      const build = project.tasks.find((t) => t.stepId === "BUILD");
      if (!build) return project.sandbox.deploymentStatus;
      if (build.status === "COMPLETED") return "PASS";
      if (build.status === "FAILED") return "FAIL";
      return build.status;
    })(),
    testStatus: (tests?.data as { passed?: boolean })?.passed
      ? "PASS"
      : tests
        ? "FAIL"
        : "NOT RUN",
    securityStatus: (() => {
      const scan = project.outputs.find((o) => o.schemaName === "SecurityScanSchema")?.data;
      const s = scan as { passed?: boolean; requiresApproval?: boolean } | undefined;
      if (!s) return "NOT RUN";
      return s.passed ? "PASS" : s.requiresApproval ? "REQUIRES_APPROVAL" : "FAIL";
    })(),
    pipelineVersion: project.pipelineVersion,
    completenessLabel:
      project.pipelineVersion === "v3" || project.pipelineVersion === "v4"
        ? "AI GENERATED STARTER"
        : "Starter landing",
    tests: tests?.data ?? null,
    securityScan:
      project.outputs.find((o) => o.schemaName === "SecurityScanSchema")?.data ?? null,
    quality: project.quality,
    persistenceMode: project.persistenceMode,
    files: code?.files?.map((f) => ({
      path: f.path,
      purpose: f.purpose,
      language: f.language,
    })),
    landing: content
      ? {
          brandName: brand?.brandName,
          colors: brand?.colorDirection,
          hero: content.hero,
          features: content.features,
          howItWorks: content.howItWorks,
          pricingCopy: content.pricingCopy,
          faq: content.faq,
          footer: content.footer,
          completeness: code?.completeness ?? "landing_page_only",
        }
      : null,
    limitations: [
      "SANDBOX PREVIEW — not production",
      project.pipelineVersion === "v3" || project.pipelineVersion === "v4"
        ? "AI GENERATED STARTER — not production-ready SaaS"
        : "Preview is AI-generated starter content",
      "Not a complete production SaaS unless further builds are approved",
      "Payments not activated (Mollie requires approval)",
      project.sandbox.isolationLabel || "SANDBOX: DEVELOPMENT ISOLATION",
      "PRODUCTION ISOLATION REQUIRED for LIVE deploy",
      project.persistenceMode === "SUPABASE"
        ? "Factory project may be persisted — generated app DB is DEMO only"
        : "LOCAL / DEMO / NOT PERSISTED",
    ],
  });
}
