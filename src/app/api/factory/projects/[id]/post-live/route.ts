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
import {
  persistFactoryProject,
  resolveFactoryProject,
} from "@/lib/factory/supabase-store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";

type Ctx = { params: Promise<{ id: string }> };

async function loadProject(
  id: string,
  body?: { project?: FactoryProject },
  userId?: string | null
) {
  let project = await resolveFactoryProject(id);
  const incoming = body?.project;
  if (
    !project &&
    incoming &&
    incoming.id === id &&
    (!userId || incoming.ownerId === userId)
  ) {
    project = saveFactoryProject(incoming);
  }
  return project ?? getFactoryProject(id) ?? null;
}

export async function GET(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  if (status.productionPersistence && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const project = await loadProject(id, undefined, user?.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (project.pipelineVersion !== "v5") {
    return NextResponse.json(
      {
        error: "Post-live roadmap is V5-only",
        pipelineVersion: project.pipelineVersion,
      },
      { status: 400 }
    );
  }
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
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  if (status.productionPersistence && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const project = await loadProject(id, raw as { project?: FactoryProject }, user?.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
