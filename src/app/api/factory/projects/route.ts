import { NextResponse } from "next/server";
import { factoryBriefSchema } from "@/lib/factory/schemas";
import {
  createFactoryProject,
  factoryPortfolioStats,
  listFactoryProjects,
} from "@/lib/factory/store";
import { estimateFullPipelineCost } from "@/lib/factory/quality";
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

    const cost = estimateFullPipelineCost();
    const { resolveRequestUser } = await import("@/lib/api/request-user");
    const user = await resolveRequestUser(request);
    const ownerId = user?.id || "demo-user";
    const project = createFactoryProject(parsed.data, ownerId);

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
      const { BusinessFactoryOrchestrator } = await import(
        "@/lib/factory/orchestrator"
      );
      const { ensureCloudflareEnv } = await import("@/lib/supabase/env");
      await ensureCloudflareEnv();
      const orch = new BusinessFactoryOrchestrator(project.id);
      result = await orch.runPipeline();
    }

    return NextResponse.json({
      project: summarize(result),
      // Always include full project for client session cache (LOCAL isolate bridge)
      fullProject: result,
      estimatedCost: {
        aiCostEur: cost.aiCostEur,
        infrastructureMonthlyEur: cost.infraMonthlyEur,
        thirdPartyMonthlyEur: cost.thirdPartyMonthlyEur,
        note: "Estimates only. Uses configured AI provider (Groq preferred when GROQ_API_KEY is set). Heuristic fallback incurs €0 AI spend.",
      },
      limitations: [
        "AI Business Factory V1 — not a full autonomous SaaS generator",
        "AI-generated outputs require your review",
        "Starter landing preview is not a complete production SaaS",
        "Production deploy, payments, domains, and marketplace publish require approval",
        "LOCAL / DEMO / NOT PERSISTED until Supabase factory schema is available",
        "No real-time market data unless an external API is connected",
      ],
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
