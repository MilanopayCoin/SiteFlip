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
      "Payment activation approved — connect Stripe keys in env (not stored in AI memory)",
      "success"
    );
    // Mark payment output as user-approved architecture, still needs integration
    const pay = [...project.outputs].reverse().find((o) => o.agent === "PaymentAgent");
    if (pay) {
      pay.implementationStatus = "requires_external_integration";
      pay.data = { ...pay.data, userApprovedActivation: true, activated: false };
    }
    saveFactoryProject(project);
    return NextResponse.json({ project, approval });
  }

  approval.status = "APPROVED";
  approval.resolvedAt = new Date().toISOString();
  appendActivity(project, "User", `Approved: ${approval.title}`, "success");
  saveFactoryProject(project);
  return NextResponse.json({ project, approval });
}
