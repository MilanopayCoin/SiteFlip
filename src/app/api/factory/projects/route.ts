import { NextResponse } from "next/server";
import { factoryBriefSchema } from "@/lib/factory/schemas";
import {
  createFactoryProject,
  factoryPortfolioStats,
  listFactoryProjects,
} from "@/lib/factory/store";
import { estimateFullPipelineCost, estimateV3PipelineCost } from "@/lib/factory/quality";
import type { PipelineVersion } from "@/lib/factory/types";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  const stats = factoryPortfolioStats("demo-user");
  return NextResponse.json({
    ...stats,
    estimatedPipelineCost: estimateFullPipelineCost(),
    projects: listFactoryProjects("demo-user").map(summarize),
  });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`factory:create:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = factoryBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pipelineVersion: PipelineVersion =
      body?.pipelineVersion === "v2"
        ? "v2"
        : body?.pipelineVersion === "v4"
          ? "v4"
          : "v3";
    const cost =
      pipelineVersion === "v2"
        ? estimateFullPipelineCost()
        : estimateV3PipelineCost();
    const { resolveRequestUser } = await import("@/lib/api/request-user");
    const user = await resolveRequestUser(request);
    const ownerId = user?.id || "demo-user";
    const project = createFactoryProject(parsed.data, ownerId, pipelineVersion);

    if (body?.profileContext && typeof body.profileContext === "object") {
      const { appendActivity, saveFactoryProject } = await import(
        "@/lib/factory/store"
      );
      appendActivity(
        project,
        "Orchestrator",
        `Profile preferences applied as AI context (explicit idea wins): ${JSON.stringify(body.profileContext).slice(0, 280)}`,
        "info"
      );
      saveFactoryProject(project);
    }

    let result = project;
    if (body?.run === true || body?.startPipeline === true) {
      const { runFactoryPipeline } = await import("@/lib/factory/orchestrator-v3");
      const { ensureCloudflareEnv } = await import("@/lib/supabase/env");
      await ensureCloudflareEnv();
      result = await runFactoryPipeline(project.id);
    }

    const limitations =
      pipelineVersion === "v2"
        ? [
            "JIY.APP Factory V2 — starter landing page pipeline",
            "AI-generated outputs require your review",
            "Starter landing preview is not a complete production SaaS",
            "Production deploy, payments, domains, and marketplace publish require approval",
            "LOCAL / DEMO / NOT PERSISTED until Supabase factory schema is available",
            "No real-time market data unless an external API is connected",
          ]
        : [
            "JIY.APP AI Business Factory — generates starter mini-SaaS scaffold",
            "AI GENERATED STARTER — not production-ready SaaS",
            "Production deploy of generated apps requires PRODUCTION ISOLATION",
            "Preview deploy available after build/test/security verification",
            "LOCAL / DEMO / NOT PERSISTED until Supabase factory schema is available",
            "SANDBOX: DEVELOPMENT ISOLATION — not production-grade sandboxing",
          ];

    return NextResponse.json({
      project: summarize(result),
      // Always include full project for client session cache (LOCAL isolate bridge)
      fullProject: result,
      pipelineVersion: result.pipelineVersion,
      estimatedCost: {
        aiCostEur: cost.aiCostEur,
        infrastructureMonthlyEur: cost.infraMonthlyEur,
        thirdPartyMonthlyEur: cost.thirdPartyMonthlyEur,
        note: "ESTIMATED BUILD COST — uses Groq when configured. HEURISTIC / AI FALLBACK incurs €0 AI spend.",
      },
      limitations,
      persistenceMode: result.persistenceMode,
    });
  } catch (error) {
    console.error("[factory/projects]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function summarize(p: ReturnType<typeof createFactoryProject>) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    pipelineVersion: p.pipelineVersion,
    state: p.state,
    currentStep: p.currentStep,
    brief: p.brief,
    quality: p.quality,
    passport: p.passport,
    persistenceMode: p.persistenceMode,
    usage: p.usage,
    sandbox: {
      previewUrl: p.sandbox.previewUrl,
      productionUrl: p.sandbox.productionUrl,
      deploymentStatus: p.sandbox.deploymentStatus,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    liveAt: p.liveAt,
  };
}
