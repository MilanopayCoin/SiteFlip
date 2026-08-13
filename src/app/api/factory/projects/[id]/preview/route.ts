import { NextResponse } from "next/server";
import { getFactoryProject, getOutputByAgent } from "@/lib/factory/store";
import { loadFactoryProject } from "@/lib/factory/supabase-store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { resolveRequestUser } from "@/lib/api/request-user";
import type {
  CodeArtifact,
  ContentPack,
  BrandPlan,
  PlanSpec,
  ProductSpec,
} from "@/lib/factory/schemas";
import type { FactoryProject } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

function v5LandingFromSpecs(project: FactoryProject) {
  const plan = getOutputByAgent(project, "PlannerAgent")?.data as
    | PlanSpec
    | undefined;
  const product = getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;
  const code = getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  if (!plan && !code) return null;

  const name = plan?.businessName || project.name;
  const pages = product?.pages?.length
    ? product.pages
    : plan?.mvpPages?.length
      ? plan.mvpPages
      : ["Landing", "Dashboard", "Settings"];

  return {
    brandName: name,
    colors: {
      primary: "#8b5cf6",
      secondary: "#6366f1",
      accent: "#a78bfa",
      background: "#07070c",
    },
    hero: {
      headline: plan?.summary?.slice(0, 120) || `${name} — AI generated starter`,
      subheadline:
        plan?.problem?.slice(0, 220) ||
        "SANDBOX PREVIEW — DEVELOPMENT ISOLATION · not production-ready SaaS",
      cta: "Open dashboard",
    },
    features: pages.slice(0, 6).map((p) => ({
      title: p,
      body: `Starter ${p} screen from V5 BUILD scaffold.`,
    })),
    howItWorks: (plan?.coreWorkflows || []).slice(0, 4).map((step, i) => ({
      step: `${i + 1}`,
      detail: step,
    })),
    pricingCopy:
      plan?.revenueModel ||
      "Starter pricing is a labeled assumption — not a live Mollie product.",
    faq: [
      {
        q: "Is this production?",
        a: "No. This is GENERATED APP LIVE under SANDBOX: DEVELOPMENT ISOLATION on Cloudflare Free.",
      },
      {
        q: "Where is ContentAgent?",
        a: "V5 builds a mini-SaaS scaffold (DeveloperAgent). This preview is synthesized from PlanSpec + ProductSpec.",
      },
    ],
    footer: `${name} · JIY.APP Factory V5 · AI GENERATED STARTER`,
    completeness: code?.completeness ?? "starter_mvp_scaffold",
  };
}

export async function GET(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const user = await resolveRequestUser(request);

  const loaded = await loadFactoryProject(id, { preferDatabase: true });
  const project = loaded.project ?? getFactoryProject(id) ?? null;
  if (!project) {
    return NextResponse.json({ error: "PROJECT NOT FOUND" }, { status: 404 });
  }

  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const landing = content
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
    : v5LandingFromSpecs(project);

  return NextResponse.json({
    previewReady: Boolean(
      code &&
        (project.sandbox.deploymentStatus !== "NOT_STARTED" ||
          project.state === "LIVE" ||
          project.state === "APPROVAL_REQUIRED" ||
          project.state === "PREVIEW")
    ),
    url: `/preview/${id}`,
    label:
      project.state === "LIVE"
        ? "GENERATED APP LIVE (platform preview)"
        : "SANDBOX PREVIEW",
    sandboxPreview: true,
    isolationLabel:
      project.sandbox.isolationLabel || "SANDBOX: DEVELOPMENT ISOLATION",
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
      const scan = project.outputs.find(
        (o) => o.schemaName === "SecurityScanSchema"
      )?.data;
      const s = scan as { passed?: boolean; requiresApproval?: boolean } | undefined;
      if (!s) return "NOT RUN";
      return s.passed ? "PASS" : s.requiresApproval ? "REQUIRES_APPROVAL" : "FAIL";
    })(),
    pipelineVersion: project.pipelineVersion,
    completenessLabel:
      project.pipelineVersion === "v3" ||
      project.pipelineVersion === "v4" ||
      project.pipelineVersion === "v5"
        ? "AI GENERATED STARTER"
        : "Starter landing",
    tests: tests?.data ?? null,
    securityScan:
      project.outputs.find((o) => o.schemaName === "SecurityScanSchema")?.data ??
      null,
    quality: project.quality,
    persistenceMode: project.persistenceMode,
    files: code?.files?.map((f) => ({
      path: f.path,
      purpose: f.purpose,
      language: f.language,
    })),
    landing,
    limitations: [
      "SANDBOX PREVIEW — not production",
      project.pipelineVersion === "v5"
        ? "GENERATED APP LIVE is platform preview under DEVELOPMENT ISOLATION"
        : project.pipelineVersion === "v3" || project.pipelineVersion === "v4"
          ? "AI GENERATED STARTER — not production-ready SaaS"
          : "Preview is AI-generated starter content",
      "Not a complete production SaaS unless further builds are approved",
      "Payments not activated (Mollie requires approval)",
      project.sandbox.isolationLabel || "SANDBOX: DEVELOPMENT ISOLATION",
      "PRODUCTION ISOLATION REQUIRED for separate production Worker",
      project.persistenceMode === "SUPABASE"
        ? "Factory project may be persisted — generated app DB is DEMO only"
        : "LOCAL / DEMO / NOT PERSISTED",
    ],
  });
}
