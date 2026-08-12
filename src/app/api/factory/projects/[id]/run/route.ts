import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import { runFactoryPipeline } from "@/lib/factory/orchestrator-v3";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import type { FactoryProject } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const ip = clientIp(request);
  const rl = rateLimit(`factory:run:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  // Cloudflare isolates do not share memory — allow client to hydrate LOCAL project
  let project = getFactoryProject(id);
  const incoming = body?.project as FactoryProject | undefined;
  if (!project && incoming && incoming.id === id) {
    if (incoming.persistenceMode === "SUPABASE") {
      return NextResponse.json(
        { error: "Only LOCAL/DEMO projects can be hydrated this way" },
        { status: 400 }
      );
    }
    project = saveFactoryProject(incoming);
  }

  if (!project) {
    return NextResponse.json(
      {
        error: "Not found",
        hint: "LOCAL projects must include the full project payload (client cache) when calling /run across Worker isolates",
      },
      { status: 404 }
    );
  }

  if (project.state === "PAUSED") {
    return NextResponse.json({ error: "Project is paused" }, { status: 400 });
  }

  try {
    const result = await runFactoryPipeline(id);
    return NextResponse.json({
      project: result,
      message:
        result.state === "APPROVAL_REQUIRED"
          ? "Pipeline reached approval gate"
          : result.state === "FAILED"
            ? "Pipeline failed"
            : "Pipeline complete",
      persistenceMode: result.persistenceMode,
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
