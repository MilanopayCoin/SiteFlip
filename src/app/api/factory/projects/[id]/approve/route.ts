import { NextResponse } from "next/server";
import {
  appendActivity,
  getFactoryProject,
  saveFactoryProject,
  updateTask,
} from "@/lib/factory/store";
import { BusinessFactoryOrchestrator } from "@/lib/factory/orchestrator";
import { runFactoryPipeline } from "@/lib/factory/orchestrator-v3";
import { z } from "zod";
import type { FactoryProject } from "@/lib/factory/types";
import { resolveFactoryProject, persistFactoryProject, persistGeneratedAppArtifact } from "@/lib/factory/supabase-store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  approvalId: z.string(),
  decision: z.enum(["APPROVE", "EDIT", "CANCEL"]),
  editNote: z.string().optional(),
  project: z.any().optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  if (status.productionPersistence && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const incoming = (raw as { project?: FactoryProject })?.project;
  let project = await resolveFactoryProject(id);
  if (
    !project &&
    incoming &&
    incoming.id === id &&
    (!user || incoming.ownerId === user.id)
  ) {
    project = saveFactoryProject(incoming);
  }
  if (!project) project = getFactoryProject(id) ?? null;
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const approval = project.approvals.find((a) => a.id === parsed.data.approvalId);
  if (!approval || approval.status !== "PENDING") {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (parsed.data.decision === "CANCEL") {
    approval.status = "CANCELLED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(project, "User", `Cancelled: ${approval.title}`, "warning");
    saveFactoryProject(project);
    await persistFactoryProject(project).catch(() => null);
    return NextResponse.json({ project, approval });
  }

  if (parsed.data.decision === "EDIT") {
    approval.status = "EDITED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(
      project,
      "User",
      `Requested edits: ${parsed.data.editNote || approval.title}`,
      "info"
    );
    saveFactoryProject(project);
    await persistFactoryProject(project).catch(() => null);
    return NextResponse.json({ project, approval });
  }

  // APPROVE
  if (approval.action === "generated_app_live") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    updateTask(project, "APPROVAL", {
      status: "COMPLETED",
      progress: 100,
      activity: "APPROVAL completed — GENERATED APP LIVE publishing",
      completedAt: new Date().toISOString(),
    });
    appendActivity(
      project,
      "User",
      "Approved GENERATED APP LIVE — running DEPLOY → LIVE (platform preview)",
      "success"
    );
    saveFactoryProject(project);

    if (project.pipelineVersion !== "v5") {
      return NextResponse.json(
        {
          error: "generated_app_live is V5-only",
          project: getFactoryProject(id),
          approval,
        },
        { status: 400 }
      );
    }

    const { goGeneratedAppLive } = await import("@/lib/factory/orchestrator-v5");
    const live = await goGeneratedAppLive(id);
    try {
      await persistFactoryProject(live);
      await persistGeneratedAppArtifact(live);
    } catch {
      // persist after LIVE; runtime already required persist before HTTP verify
    }
    return NextResponse.json({
      project: live,
      approval,
      note:
        live.state === "LIVE"
          ? "GENERATED APP LIVE — platform preview under DEVELOPMENT ISOLATION (not production Worker isolation)"
          : "DEPLOY failed — see project activity",
    });
  }

  if (approval.action === "production_deploy") {
    // Mark approved — actual deploy happens via DEPLOY MY BUSINESS (isolation gate)
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(
      project,
      "User",
      "Production deployment approved — click DEPLOY MY BUSINESS to attempt deploy (isolation may still block)",
      "success"
    );
    saveFactoryProject(project);

    if (project.pipelineVersion === "v2") {
      const orch = new BusinessFactoryOrchestrator(id);
      const live = orch.approveProduction();
      return NextResponse.json({ project: live, approval });
    }

    // V3/V4: approval only — deploy endpoint performs isolation-gated deploy
    return NextResponse.json({
      project: getFactoryProject(id),
      approval,
      next: "POST /api/factory/projects/:id/deploy with action=production",
      note: "PRODUCTION ISOLATION REQUIRED may still block LIVE",
    });
  }

  if (approval.action === "cost_threshold") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(project, "User", "Approved cost threshold — re-run pipeline", "success");
    saveFactoryProject(project);
    const result = await runFactoryPipeline(id);
    return NextResponse.json({ project: result, approval });
  }

  if (approval.action === "payment_activation") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(
      project,
      "User",
      "Payment activation approved — connect provider keys in env (not stored in AI memory)",
      "success"
    );
    const pay = [...project.outputs].reverse().find((o) => o.agent === "PaymentAgent");
    if (pay) {
      pay.implementationStatus = "requires_external_integration";
      pay.data = { ...pay.data, userApprovedActivation: true, activated: false };
    }
    saveFactoryProject(project);
    return NextResponse.json({ project, approval });
  }

  if (approval.action === "landing_page_finalize") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    const landing = [...project.outputs]
      .reverse()
      .find((o) => o.agent === "DeveloperAgent");
    if (landing) landing.implementationStatus = "user_approved";
    appendActivity(project, "User", "Landing page finalized (sandbox only)", "success");
    saveFactoryProject(project);
    return NextResponse.json({ project, approval });
  }

  if (
    approval.action === "marketplace_listing" ||
    approval.action === "publish_listing"
  ) {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(
      project,
      "User",
      approval.action === "publish_listing"
        ? "Marketplace publish approved — complete listing on /sell (not auto-published)"
        : "Marketplace listing prep approved — use BUILD → SELL to generate draft",
      "success"
    );
    saveFactoryProject(project);
    return NextResponse.json({
      project,
      approval,
      next: `/build/${id}/sell`,
    });
  }

  if (approval.action === "domain_connect") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(
      project,
      "User",
      "Domain connection approved — configure DNS externally (not automated)",
      "success"
    );
    saveFactoryProject(project);
    return NextResponse.json({ project, approval });
  }

  approval.status = "APPROVED";
  approval.resolvedAt = new Date().toISOString();
  appendActivity(project, "User", `Approved: ${approval.title}`, "success");
  saveFactoryProject(project);
  return NextResponse.json({ project, approval });
}
