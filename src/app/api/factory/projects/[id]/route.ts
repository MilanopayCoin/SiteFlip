import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import { PIPELINE_STEPS } from "@/lib/factory/types";
import type { FactoryProject } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let project = getFactoryProject(id);

  // Allow client to rehydrate LOCAL project into this isolate
  if (!project) {
    const url = new URL(request.url);
    if (url.searchParams.get("hydrate") === "1") {
      // no body on GET — handled via POST hydrate below
    }
  }

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    project,
    pipeline: PIPELINE_STEPS,
    pendingApprovals: project.approvals.filter((a) => a.status === "PENDING"),
  });
}

/** Rehydrate a LOCAL/DEMO project into this Worker isolate */
export async function PUT(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const incoming = body?.project as FactoryProject | undefined;
  if (!incoming || incoming.id !== id) {
    return NextResponse.json({ error: "Invalid project payload" }, { status: 400 });
  }
  if (incoming.persistenceMode === "SUPABASE") {
    return NextResponse.json(
      { error: "Only LOCAL/DEMO projects can be hydrated this way" },
      { status: 400 }
    );
  }
  const saved = saveFactoryProject(incoming);
  return NextResponse.json({
    project: saved,
    pipeline: PIPELINE_STEPS,
    pendingApprovals: saved.approvals.filter((a) => a.status === "PENDING"),
  });
}
