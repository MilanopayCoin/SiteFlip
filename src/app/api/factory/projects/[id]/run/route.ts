import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  loadFactoryProject,
  persistFactoryProject,
} from "@/lib/factory/supabase-store";
import { runFactoryPipeline } from "@/lib/factory/orchestrator-v3";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { resolveRequestUser } from "@/lib/api/request-user";
import type { FactoryProject } from "@/lib/factory/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const ip = clientIp(request);
  const rl = rateLimit(`factory:run:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);

  let project = (await loadFactoryProject(id)).project ?? getFactoryProject(id);
  const incoming = body?.project as FactoryProject | undefined;

  if (!project && incoming && incoming.id === id) {
    if (status.productionPersistence) {
      if (!user || incoming.ownerId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (incoming.persistenceMode === "SUPABASE") {
      return NextResponse.json(
        { error: "Only LOCAL/DEMO projects can be hydrated this way" },
        { status: 400 }
      );
    }
    project = saveFactoryProject(incoming);
  }

  if (!project) {
    return NextResponse.json(
      {
        error: "Not found",
        hint: "LOCAL projects must include the full project payload (client cache) when calling /run across Worker isolates",
      },
      { status: 404 }
    );
  }

  if (status.productionPersistence) {
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (project.state === "PAUSED") {
    return NextResponse.json({ error: "Project is paused" }, { status: 400 });
  }

  try {
    const fastCreate =
      body?.fastCreate === true ||
      body?.mode === "fast" ||
      body?.createMode === "fast" ||
      project.sandbox?.createMode === "fast" ||
      // Default Fast Create when client does not opt into full V5
      (body?.fastCreate !== false &&
        body?.mode !== "full" &&
        body?.createMode !== "full" &&
        project.sandbox?.createMode !== "full");
    const result = await runFactoryPipeline(id, { fastCreate });
    const persisted = await persistFactoryProject(result);
    if (persisted.mode === "supabase") {
      result.persistenceMode = "SUPABASE";
    }
    // Cloudflare Free may exhaust subrequests during a long V5 run.
    // Still return the completed project so the client can PUT-persist in a
    // fresh Worker invocation (new subrequest budget).
    if (status.productionPersistence && !persisted.ok) {
      const subrequestExhausted = /too many subrequests/i.test(
        persisted.error || ""
      );
      return NextResponse.json({
        project: result,
        message:
          result.state === "APPROVAL_REQUIRED"
            ? "Pipeline reached approval gate"
            : result.state === "FAILED"
              ? "Pipeline failed"
              : "Pipeline complete",
        persistenceMode: result.persistenceMode,
        schemaReady: status.schemaReady,
        persistOk: false,
        persistDeferred: subrequestExhausted,
        persistError: persisted.error,
        note: subrequestExhausted
          ? "Pipeline finished in-memory — client should PUT project to persist (Worker Free subrequest limit)"
          : "Pipeline finished but persist failed",
      });
    }
    return NextResponse.json({
      project: result,
      message:
        result.state === "APPROVAL_REQUIRED"
          ? "Pipeline reached approval gate"
          : result.state === "FAILED"
            ? "Pipeline failed"
            : "Pipeline complete",
      persistenceMode: result.persistenceMode,
      schemaReady: status.schemaReady,
      persistOk: true,
    });
  } catch (error) {
    console.error("[factory/run]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Pipeline failed",
      },
      { status: 500 }
    );
  }
}
