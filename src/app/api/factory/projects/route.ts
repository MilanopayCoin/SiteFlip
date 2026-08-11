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
    const project = createFactoryProject(parsed.data, "demo-user");

    return NextResponse.json({
      project: summarize(project),
      estimatedCost: {
        aiCostEur: cost.aiCostEur,
        infrastructureMonthlyEur: cost.infraMonthlyEur,
        thirdPartyMonthlyEur: cost.thirdPartyMonthlyEur,
        note: "Estimates only. Heuristic agents incur €0 AI spend when OPENAI_API_KEY is unset.",
      },
      limitations: [
        "AI-generated outputs require your review",
        "Landing preview is not a full production SaaS",
        "Production deploy, payments, and domains require approval",
        "No real-time market data unless an external API is connected",
      ],
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
