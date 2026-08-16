import { NextResponse } from "next/server";
import {
  addChange,
  appendActivity,
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  request: z.string().min(5),
});

/** AI change request — creates a plan requiring approval before applying */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const plan = {
    request: parsed.data.request,
    analysis: {
      currentState: project.state,
      brandRules: project.memory.find((m) => m.kind === "brand_rules")?.key,
      productSpec: Boolean(project.memory.find((m) => m.kind === "product_spec")),
    },
    filesAffected: ["sandbox/app/page.tsx", "factory content output"],
    potentialRisks: [
      "Brand inconsistency",
      "SEO metadata drift",
      "Preview content mismatch with approved specs",
    ],
    preview: "Change will regenerate ContentAgent + DeveloperAgent landing after approval",
    status: "PENDING_APPROVAL",
  };

  addChange(project, {
    projectId: project.id,
    agent: "User",
    reason: parsed.data.request,
    filesChanged: plan.filesAffected,
    approvalStatus: "PENDING",
    result: "change plan created — not applied",
    rollbackOf: null,
  });

  const { addApproval } = await import("@/lib/factory/store");
  addApproval(project, {
    projectId: project.id,
    action: "change_request",
    title: "Approve AI change request",
    explanation: parsed.data.request,
    services: ["ContentAgent", "DeveloperAgent"],
    estimatedCostEur: 0.9,
    risks: plan.potentialRisks,
  });

  appendActivity(project, "User", `Change requested: ${parsed.data.request}`, "info");
  saveFactoryProject(project);

  return NextResponse.json({
    changePlan: plan,
    actions: ["APPROVE", "EDIT", "CANCEL"],
    note: "Change is NOT applied until approved. Destructive rollback also requires confirmation.",
  });
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ changes: project.changes });
}
