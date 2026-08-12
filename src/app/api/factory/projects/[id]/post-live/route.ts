import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  attemptV5PostLiveGate,
  getV5PostLiveSnapshot,
} from "@/lib/factory/v5-post-live";
import type { FactoryProject } from "@/lib/factory/types";
import { persistFactoryProject } from "@/lib/factory/supabase-store";

type Ctx = { params: Promise<{ id: string }> };

function hydrate(id: string, body: { project?: FactoryProject }) {
  let project = getFactoryProject(id);
  const incoming = body?.project;
  if (
    !project &&
    incoming &&
    incoming.id === id &&
    incoming.persistenceMode !== "SUPABASE"
  ) {
    project = saveFactoryProject(incoming);
  }
  return project;
}

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  // Allow client to hydrate LOCAL projects via query is not needed — use body on POST
  let project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.pipelineVersion !== "v5") {
    return NextResponse.json(
      { error: "Post-live roadmap is V5-only", pipelineVersion: project.pipelineVersion },
      { status: 400 }
    );
  }
  void url;
  return NextResponse.json({
    snapshot: getV5PostLiveSnapshot(project),
    youAreHere: "GENERATED APP LIVE",
    next: "REAL PRODUCTION ISOLATION",
  });
}

const bodySchema = z.object({
  stepId: z.enum([
    "PRODUCTION_ISOLATION",
    "SEPARATE_RUNTIME",
    "CUSTOM_DOMAIN",
    "MOLLIE",
    "GROWTH",
  ]),
  project: z.any().optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const raw = await request.json().catch(() => ({}));
  const project = hydrate(id, raw as { project?: FactoryProject });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.pipelineVersion !== "v5") {
    return NextResponse.json(
      { error: "Post-live roadmap is V5-only" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await attemptV5PostLiveGate(id, parsed.data.stepId);
  try {
    await persistFactoryProject(result.project);
  } catch {
    // persistence optional
  }

  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    snapshot: result.snapshot,
    project: result.project,
    youAreHere: result.snapshot.youAreHereLabel,
  });
}
