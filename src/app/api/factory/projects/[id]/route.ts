import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  loadFactoryProject,
  persistFactoryProject,
} from "@/lib/factory/supabase-store";
import { getPipelineSteps } from "@/lib/factory/types";
import type { FactoryProject } from "@/lib/factory/types";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);

  const loaded = await loadFactoryProject(id, { preferDatabase: true });
  const project = loaded.project ?? getFactoryProject(id) ?? null;

  if (!project) {
    return NextResponse.json(
      { error: "PROJECT NOT FOUND", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    project,
    pipeline: getPipelineSteps(project.pipelineVersion ?? "v2"),
    pendingApprovals: project.approvals.filter((a) => a.status === "PENDING"),
    persistenceMode: project.persistenceMode,
    schemaReady: status.schemaReady,
  });
}

/** Rehydrate a LOCAL/DEMO project into this Worker isolate */
export async function PUT(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  const body = await request.json().catch(() => null);
  const incoming = body?.project as FactoryProject | undefined;
  if (!incoming || incoming.id !== id) {
    return NextResponse.json({ error: "Invalid project payload" }, { status: 400 });
  }

  if (status.productionPersistence) {
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (incoming.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const existing = await loadFactoryProject(id);
    if (existing.project && existing.project.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Never let a stale browser cache wipe richer server/memory state
    if (existing.project) {
      const server = existing.project;
      const serverRunning = server.tasks.some((t) => t.status === "RUNNING");
      const serverRicher =
        server.outputs.length > (incoming.outputs?.length ?? 0) ||
        (Date.parse(server.updatedAt) || 0) > (Date.parse(incoming.updatedAt) || 0);
      if (serverRunning || serverRicher) {
        return NextResponse.json({
          project: server,
          pipeline: getPipelineSteps(server.pipelineVersion ?? "v2"),
          pendingApprovals: server.approvals.filter((a) => a.status === "PENDING"),
          persistenceMode: server.persistenceMode,
          note: "Server state kept — stale client cache was not applied",
        });
      }
    }
    const saved = saveFactoryProject(incoming);
    const persisted = await persistFactoryProject(saved);
    if (!persisted.ok) {
      return NextResponse.json(
        {
          error: "Persist failed",
          details: persisted.error,
          note: "DEMO fallback disabled — production Supabase is healthy",
        },
        { status: 503 }
      );
    }
    saved.persistenceMode = "SUPABASE";
    return NextResponse.json({
      project: saved,
      pipeline: getPipelineSteps(saved.pipelineVersion ?? "v2"),
      pendingApprovals: saved.approvals.filter((a) => a.status === "PENDING"),
      persistenceMode: "SUPABASE",
    });
  }

  if (incoming.persistenceMode === "SUPABASE") {
    return NextResponse.json(
      { error: "Only LOCAL/DEMO projects can be hydrated this way when schema is not ready" },
      { status: 400 }
    );
  }
  const saved = saveFactoryProject(incoming);
  return NextResponse.json({
    project: saved,
    pipeline: getPipelineSteps(saved.pipelineVersion ?? "v2"),
    pendingApprovals: saved.approvals.filter((a) => a.status === "PENDING"),
    persistenceMode: saved.persistenceMode,
  });
}
