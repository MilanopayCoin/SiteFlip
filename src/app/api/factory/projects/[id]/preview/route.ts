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
    buildStatus: project.sandbox.deploymentStatus,
    tests: tests?.data ?? null,
    quality: project.quality,
    securityStatus: "Sandbox isolated · secrets not in memory · generated code scanned",
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
          pricingCopy: content.pricingCopy,
          faq: content.faq,
          completeness: code?.completeness ?? "landing_page_only",
        }
      : null,
    limitations: [
      "Preview is AI-generated starter content",
      "Not a complete production SaaS unless further builds are approved",
      "Payments not activated",
    ],
  });
}
