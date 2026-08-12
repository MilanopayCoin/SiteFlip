import { NextResponse } from "next/server";
import { getFactoryProject, getOutputByAgent } from "@/lib/factory/store";
import { commandCenterReply } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ prompt: z.string().min(3).max(2000) });

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const ip = clientIp(request);
  const rl = rateLimit(`factory:command:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const context = {
    projectId: project.id,
    name: project.name,
    state: project.state,
    brief: project.brief,
    quality: project.quality,
    passport: project.passport,
    persistenceMode: project.persistenceMode,
    deployment: project.sandbox.deploymentStatus,
    previewUrl: project.sandbox.previewUrl,
    productionUrl: project.sandbox.productionUrl,
    growthPlan: project.growthPlan,
    outputsPresent: project.outputs.map((o) => o.agent),
    businessPlan: getOutputByAgent(project, "BusinessAgent")?.data ?? null,
    marketAnalysis: getOutputByAgent(project, "MarketAgent")?.data ?? null,
    brand: getOutputByAgent(project, "BrandAgent")?.data ?? null,
    product: getOutputByAgent(project, "ProductAgent")?.data ?? null,
    architecture: getOutputByAgent(project, "ArchitectureAgent")?.data ?? null,
    codeCompleteness:
      (getOutputByAgent(project, "DeveloperAgent")?.data as { completeness?: string })
        ?.completeness ?? null,
    paymentsActivated: Boolean(
      (getOutputByAgent(project, "PaymentAgent")?.data as { activated?: boolean })
        ?.activated
    ),
    rule: "Never invent project metrics. Never pretend a feature exists unless present in outputs/state. Factory V1 is not a full SaaS generator.",
  };

  const result = await commandCenterReply(parsed.data.prompt, context);
  return NextResponse.json({
    reply: result.reply,
    assumptions: result.assumptions,
    source: result.source,
    inspectedState: {
      state: project.state,
      outputs: context.outputsPresent,
      codeCompleteness: context.codeCompleteness,
      paymentsActivated: context.paymentsActivated,
    },
  });
}
