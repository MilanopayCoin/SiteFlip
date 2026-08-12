import { NextResponse } from "next/server";
import { getFactoryProject } from "@/lib/factory/store";
import { BusinessFactoryOrchestrator } from "@/lib/factory/orchestrator";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const ip = clientIp(request);
  const rl = rateLimit(`factory:run:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.state === "PAUSED") {
    return NextResponse.json({ error: "Project is paused" }, { status: 400 });
  }

  try {
    const orchestrator = new BusinessFactoryOrchestrator(id);
    const result = await orchestrator.runPipeline();
    return NextResponse.json({
      project: result,
      message:
        result.state === "APPROVAL_REQUIRED"
          ? "Pipeline reached approval gate"
          : result.state === "FAILED"
            ? "Pipeline failed"
            : "Pipeline complete",
    });
  } catch (error) {
    console.error("[factory/run]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Pipeline failed",
      },
      { status: 500 }
    );
  }
}
