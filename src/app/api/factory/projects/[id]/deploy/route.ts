import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  canDeployProduction,
  deployPreview,
  deployProduction,
  getProjectDeployments,
  rollbackProject,
} from "@/lib/factory/deployment";
import { getRuntimeIsolationProvider } from "@/lib/factory/deployment/isolation";
import { getOutputByAgent } from "@/lib/factory/store";
import type { CodeArtifact } from "@/lib/factory/schemas";
import type { FactoryProject } from "@/lib/factory/types";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

function hydrate(id: string, body: { project?: FactoryProject }) {
  let project = getFactoryProject(id);
  const incoming = body?.project;
  if (!project && incoming && incoming.id === id && incoming.persistenceMode !== "SUPABASE") {
    project = saveFactoryProject(incoming);
  }
  return project;
}

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const code = getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const isolation = getRuntimeIsolationProvider().checkIsolation({
    projectId: id,
    code: code ?? null,
  });
  const gate = await canDeployProduction(id);
  const deployments = getProjectDeployments(id);

  return NextResponse.json({
    projectId: id,
    deployments,
    isolation,
    productionGate: gate,
    previewUrl: project.sandbox.previewUrl,
    productionUrl: project.sandbox.productionUrl,
    deploymentStatus: deployments[0]?.status ?? "NOT_DEPLOYED",
    label: "AI GENERATED STARTER",
    notes: [
      "Generated apps are NOT deployed into the main JIY.APP production Worker",
      "Production LIVE requires PRODUCTION ISOLATION — currently blocked",
      "Preview can go LIVE after build/test/security/health verification",
    ],
  });
}

const bodySchema = z.object({
  action: z.enum(["preview", "production", "rollback"]),
  targetDeploymentId: z.string().optional(),
  project: z.any().optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const ip = clientIp(request);
  const rl = rateLimit(`factory:deploy:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const raw = await request.json().catch(() => ({}));
  const project = hydrate(id, raw as { project?: FactoryProject });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "preview") {
      const result = await deployPreview(id);
      return NextResponse.json({
        ...result,
        project: getFactoryProject(id),
        message:
          result.deployment.status === "LIVE"
            ? "Preview LIVE after verification"
            : `Preview deploy ${result.deployment.status}`,
      });
    }

    if (parsed.data.action === "production") {
      // Require pending production_deploy approval
      const approval = project.approvals.find(
        (a) => a.action === "production_deploy" && a.status === "APPROVED"
      );
      if (!approval) {
        return NextResponse.json(
          {
            error: "Approval required",
            message:
              "Approve production deployment first, then click DEPLOY MY BUSINESS",
            blocked: true,
          },
          { status: 403 }
        );
      }

      const result = await deployProduction(id);
      return NextResponse.json({
        ...result,
        project: getFactoryProject(id),
        message: result.blocked
          ? "PRODUCTION ISOLATION REQUIRED — production deploy blocked"
          : "Production LIVE after verification",
      });
    }

    if (parsed.data.action === "rollback") {
      if (!parsed.data.targetDeploymentId) {
        return NextResponse.json(
          { error: "targetDeploymentId required" },
          { status: 400 }
        );
      }
      const deployment = await rollbackProject(
        id,
        parsed.data.targetDeploymentId
      );
      return NextResponse.json({
        deployment,
        project: getFactoryProject(id),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Deploy failed",
      },
      { status: 500 }
    );
  }
}
