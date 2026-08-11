import { NextResponse } from "next/server";
import { getFactoryProject } from "@/lib/factory/store";
import { PIPELINE_STEPS } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    project,
    pipeline: PIPELINE_STEPS,
    pendingApprovals: project.approvals.filter((a) => a.status === "PENDING"),
  });
}
