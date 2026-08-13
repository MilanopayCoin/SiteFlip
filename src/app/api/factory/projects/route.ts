import { NextResponse } from "next/server";
import { factoryBriefSchema } from "@/lib/factory/schemas";
import {
  createFactoryProject,
  factoryPortfolioStats,
  appendActivity,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  listPersistedFactoryProjects,
  persistFactoryProject,
} from "@/lib/factory/supabase-store";
import { estimateFullPipelineCost, estimateV3PipelineCost } from "@/lib/factory/quality";
import type { PipelineVersion } from "@/lib/factory/types";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  const ownerId = user?.id;

  // Unauthenticated visitors can load the /build page — show empty portfolio + auth CTA
  // instead of a hard 401 that looks like a broken factory.
  if (status.productionPersistence && !ownerId) {
    return NextResponse.json({
      activeBuilds: 0,
      completed: 0,
      growing: 0,
      forSale: 0,
      rented: 0,
      revived: 0,
      portfolioValueEur: 0,
      estimatedPipelineCost: estimateFullPipelineCost(),
      projects: [],
      persistenceMode: "SUPABASE",
      schemaReady: status.schemaReady,
      productionPersistence: true,
      authRequired: true,
      authenticated: false,
      note: "Sign in to create and load persisted factory projects",
    });
  }

  const listed = await listPersistedFactoryProjects(ownerId || "demo-user");
  const projects = listed.projects;
  const stats = factoryPortfolioStats(ownerId || "demo-user");

  return NextResponse.json({
    ...stats,
    estimatedPipelineCost: estimateFullPipelineCost(),
    projects: projects.map(summarize),
    persistenceMode: listed.mode === "supabase" ? "SUPABASE" : "LOCAL",
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    authRequired: false,
    authenticated: Boolean(ownerId),
    note:
      listed.mode === "supabase"
        ? "Factory projects loaded from Supabase"
        : status.reason || "LOCAL / DEMO / NOT PERSISTED",
  });
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const ip = clientIp(request);
  const rl = rateLimit(`factory:create:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const status = await getSchemaStatus();
    const body = await request.json();
    const parsed = factoryBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pipelineVersion: PipelineVersion =
      body?.pipelineVersion === "v2"
        ? "v2"
        : body?.pipelineVersion === "v5"
          ? "v5"
          : body?.pipelineVersion === "v4"
            ? "v4"
            : "v3";
    const cost =
      pipelineVersion === "v2"
        ? estimateFullPipelineCost()
        : estimateV3PipelineCost();
    const user = await resolveRequestUser(request);

    if (status.productionPersistence && !user) {
      return NextResponse.json(
        {
          error: "Authentication required to create persisted factory projects",
          code: "AUTH_REQUIRED",
          loginUrl: "/login?next=/build",
          signupUrl: "/signup?next=/build",
          note: "DEMO fallback disabled — production Supabase is healthy. Sign in to create permanent V5 factory projects.",
        },
        { status: 401 }
      );
    }

    const ownerId = user?.id || "demo-user";
    // owner_id must be a real profiles UUID when persisting
    if (
      status.productionPersistence &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ownerId
      )
    ) {
      return NextResponse.json(
        { error: "Valid Supabase Auth user required for factory persistence" },
        { status: 401 }
      );
    }

    const project = createFactoryProject(parsed.data, ownerId, pipelineVersion);

    // Stamp create mode before persist so later /run uses Fast Create by default
    const wantFast =
      pipelineVersion === "v5" &&
      body?.fastCreate !== false &&
      body?.mode !== "full" &&
      body?.createMode !== "full";
    if (wantFast) {
      project.sandbox.createMode = "fast";
      saveFactoryProject(project);
    } else if (pipelineVersion === "v5" && body?.createMode === "full") {
      project.sandbox.createMode = "full";
      saveFactoryProject(project);
    }

    if (body?.profileContext && typeof body.profileContext === "object") {
      appendActivity(
        project,
        "Orchestrator",
        `Profile preferences applied as AI context (explicit idea wins): ${JSON.stringify(body.profileContext).slice(0, 280)}`,
        "info"
      );
      saveFactoryProject(project);
    }

    let result = project;
    if (body?.run === true || body?.startPipeline === true) {
      const { runFactoryPipeline } = await import("@/lib/factory/orchestrator-v3");
      // Default Fast Create on Cloudflare Free — avoids Error 1102 (CPU/subrequest
      // limits) from full V5 TEST/SECURITY/GROWTH in one Worker invocation.
      // Pass fastCreate:false explicitly for the long path (not recommended on Free).
      result = await runFactoryPipeline(project.id, { fastCreate: wantFast });
    }

    const persisted = await persistFactoryProject(result);
    let persistOk = persisted.ok && persisted.mode === "supabase";
    let persistDeferred = false;
    if (persistOk) {
      result.persistenceMode = "SUPABASE";
      appendActivity(
        result,
        "Orchestrator",
        "Factory project persisted to Supabase",
        "success"
      );
      saveFactoryProject(result);
    } else if (status.productionPersistence && !persisted.ok) {
      // After a long pipeline, Free Workers may hit subrequest limits.
      // Still return the project so the client can PUT in a fresh invocation.
      const subrequestExhausted = /too many subrequests/i.test(
        persisted.error || ""
      );
      persistDeferred = subrequestExhausted || Boolean(result.outputs?.length);
      if (!persistDeferred) {
        return NextResponse.json(
          {
            error: "Failed to persist factory project",
            details: persisted.error,
            note: "DEMO fallback disabled — production Supabase is healthy",
          },
          { status: 503 }
        );
      }
    }

    const persistedNote =
      result.persistenceMode === "SUPABASE"
        ? "Persisted to Supabase factory_projects"
        : persistDeferred
          ? "Pipeline finished — client should PUT to persist (Worker Free subrequest limit)"
          : "LOCAL / DEMO / NOT PERSISTED until Supabase factory schema is available";

    const limitations =
      pipelineVersion === "v2"
        ? [
            "JIY.APP Factory V2 — starter landing page pipeline",
            "AI-generated outputs require your review",
            "Starter landing preview is not a complete production SaaS",
            "Production deploy, payments, domains, and marketplace publish require approval",
            persistedNote,
            "No real-time market data unless an external API is connected",
          ]
        : [
            "JIY.APP AI Business Factory — generates starter mini-SaaS scaffold",
            "AI GENERATED STARTER — not production-ready SaaS",
            "Production deploy of generated apps requires PRODUCTION ISOLATION",
            "Preview deploy available after build/test/security verification",
            persistedNote,
            "SANDBOX: DEVELOPMENT ISOLATION — not production-grade sandboxing",
          ];

    return NextResponse.json({
      project: summarize(result),
      fullProject: result,
      pipelineVersion: result.pipelineVersion,
      estimatedCost: {
        aiCostEur: cost.aiCostEur,
        infrastructureMonthlyEur: cost.infraMonthlyEur,
        thirdPartyMonthlyEur: cost.thirdPartyMonthlyEur,
        note: "ESTIMATED BUILD COST — uses Groq when configured. HEURISTIC / AI FALLBACK incurs €0 AI spend.",
      },
      limitations,
      persistenceMode: result.persistenceMode,
      schemaReady: status.schemaReady,
      productionPersistence: status.productionPersistence,
      persistOk,
      persistDeferred,
      persistError: persistOk ? undefined : persisted.error,
    });
  } catch (error) {
    console.error("[factory/projects]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function summarize(p: ReturnType<typeof createFactoryProject>) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    pipelineVersion: p.pipelineVersion,
    state: p.state,
    currentStep: p.currentStep,
    brief: p.brief,
    quality: p.quality,
    passport: p.passport,
    persistenceMode: p.persistenceMode,
    usage: p.usage,
    sandbox: {
      previewUrl: p.sandbox.previewUrl,
      productionUrl: p.sandbox.productionUrl,
      deploymentStatus: p.sandbox.deploymentStatus,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    liveAt: p.liveAt,
  };
}
