import { NextResponse } from "next/server";
import {
  appendActivity,
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import { BusinessFactoryOrchestrator } from "@/lib/factory/orchestrator";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  approvalId: z.string(),
  decision: z.enum(["APPROVE", "EDIT", "CANCEL"]),
  editNote: z.string().optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json());
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
    return NextResponse.json({ project, approval });
  }

  // APPROVE
  if (approval.action === "production_deploy") {
    const orch = new BusinessFactoryOrchestrator(id);
    const live = orch.approveProduction();
    return NextResponse.json({ project: live, approval });
  }

  if (approval.action === "cost_threshold") {
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    appendActivity(project, "User", "Approved cost threshold — re-run pipeline", "success");
    saveFactoryProject(project);
    const orch = new BusinessFactoryOrchestrator(id);
    const result = await orch.runPipeline();
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
