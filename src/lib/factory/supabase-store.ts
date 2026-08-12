/**
 * Factory project persistence to Supabase when schema is ready.
 * Source of truth: factory_projects + factory_outputs (+ runs).
 * Never stores secrets. Never claims persistence without DB writes.
 */

import { createServiceClient, createClient } from "@/lib/supabase/server";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import type { FactoryProject, FactoryOutput, FactoryPersistenceMode } from "./types";
import {
  getFactoryProject as getMemoryProject,
  saveFactoryProject as saveMemoryProject,
  listFactoryProjects as listMemoryProjects,
} from "./store";

/** Prefer authenticated session (RLS). Service role only if session client missing. */
async function factoryClient() {
  return (await createClient()) || (await createServiceClient());
}
/** DB enum factory_project_state has no READY — map + keep app state in sandbox */
const DB_STATES = new Set([
  "IDEA",
  "PLANNING",
  "RESEARCHING",
  "DESIGNING",
  "BUILDING",
  "TESTING",
  "PREVIEW",
  "APPROVAL_REQUIRED",
  "DEPLOYING",
  "LIVE",
  "FAILED",
  "PAUSED",
  "ARCHIVED",
]);

function toDbState(state: FactoryProject["state"]): string {
  if (state === "READY") return "PREVIEW";
  if (DB_STATES.has(state)) return state;
  return "BUILDING";
}

function toDbProject(project: FactoryProject) {
  return {
    id: project.id,
    owner_id: project.ownerId,
    name: project.name,
    slug: project.slug,
    state: toDbState(project.state),
    brief: project.brief,
    current_step: project.currentStep,
    quality: project.quality,
    growth_plan: project.growthPlan
      ? { items: project.growthPlan }
      : null,
    sandbox: {
      ...project.sandbox,
      appState: project.state,
      pipelineVersion: project.pipelineVersion,
      passport: project.passport,
      approvals: project.approvals,
      tasks: project.tasks,
      changes: project.changes,
      memory: project.memory,
      activityLog: project.activityLog.slice(0, 50),
      // Cloudflare Free: embed outputs so a single project upsert survives
      // when factory_outputs writes exhaust Worker subrequest budget.
      outputsEmbedded: project.outputs,
    },
    usage: project.usage,
    live_at: project.liveAt,
    updated_at: new Date().toISOString(),
  };
}

function fromDbProject(
  row: Record<string, unknown>,
  outputs: FactoryOutput[] = []
): FactoryProject {
  const sandbox = (row.sandbox || {}) as Record<string, unknown>;
  const growth = row.growth_plan as { items?: string[] } | null;
  const appState =
    (sandbox.appState as FactoryProject["state"] | undefined) ||
    (row.state as FactoryProject["state"]);
  const embedded = Array.isArray(sandbox.outputsEmbedded)
    ? (sandbox.outputsEmbedded as FactoryOutput[])
    : [];
  const resolvedOutputs = outputs.length ? outputs : embedded;
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    slug: String(row.slug),
    pipelineVersion:
      (sandbox.pipelineVersion as FactoryProject["pipelineVersion"]) || "v3",
    state: appState,
    brief: (row.brief || {}) as FactoryProject["brief"],
    currentStep: (row.current_step as FactoryProject["currentStep"]) ?? null,
    tasks: (sandbox.tasks as FactoryProject["tasks"]) || [],
    outputs: resolvedOutputs,
    approvals: (sandbox.approvals as FactoryProject["approvals"]) || [],
    changes: (sandbox.changes as FactoryProject["changes"]) || [],
    memory: (sandbox.memory as FactoryProject["memory"]) || [],
    sandbox: {
      projectId: String(row.id),
      ownerId: String(row.owner_id),
      businessId:
        (sandbox.businessId as string | undefined) || String(row.id),
      sandboxId: (sandbox.sandboxId as string | null | undefined) ?? null,
      runtimeId: (sandbox.runtimeId as string | null | undefined) ?? null,
      schemaStrategy: "isolated_schema",
      storagePrefix:
        (sandbox.storagePrefix as string | undefined) ||
        `sandboxes/${row.id}/`,
      envConfigKeys:
        (sandbox.envConfigKeys as string[] | undefined) || [],
      buildLogs: ((sandbox as { buildLogs?: string[] }).buildLogs) || [],
      deploymentStatus:
        ((sandbox as { deploymentStatus?: FactoryProject["sandbox"]["deploymentStatus"] })
          .deploymentStatus) || "NOT_STARTED",
      previewUrl: (sandbox as { previewUrl?: string | null }).previewUrl ?? null,
      productionUrl:
        (sandbox as { productionUrl?: string | null }).productionUrl ?? null,
      lifecycle: (sandbox.lifecycle as string | null | undefined) ?? null,
      isolationLabel:
        (sandbox.isolationLabel as string | undefined) ||
        "SANDBOX: DEVELOPMENT ISOLATION",
      isProductionGrade: Boolean(sandbox.isProductionGrade),
    },
    usage: (row.usage || {
      projectId: String(row.id),
      aiTokensEstimated: 0,
      aiCostEurEstimated: 0,
      aiRequestCount: 0,
      buildAttempts: 0,
      infrastructureMonthlyEur: 0,
      thirdPartyMonthlyEur: 0,
      buildCostEur: 0,
      budgetLimitEur: null,
      costThresholdEur: 10,
    }) as FactoryProject["usage"],
    quality: (row.quality as FactoryProject["quality"]) ?? null,
    passport: (sandbox.passport as FactoryProject["passport"]) ?? null,
    growthPlan: growth?.items ?? null,
    persistenceMode: "SUPABASE" as FactoryPersistenceMode,
    activityLog:
      (sandbox.activityLog as FactoryProject["activityLog"]) || [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    liveAt: row.live_at ? String(row.live_at) : null,
  };
}

export async function persistFactoryProject(
  project: FactoryProject
): Promise<{ ok: boolean; mode: "supabase" | "demo"; error?: string }> {
  const status = await getSchemaStatus();
  // Always keep memory mirror for Worker isolate bridging
  saveMemoryProject(project);

  if (!status.productionPersistence) {
    return {
      ok: true,
      mode: "demo",
      error: status.reason || "Schema not ready — LOCAL/DEMO only",
    };
  }

  const supabase = await factoryClient();
  if (!supabase) {
    return { ok: false, mode: "demo", error: "Supabase client unavailable" };
  }

  // factory_projects.id is UUID — require UUID-shaped ids
  const uuidOk =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      project.id
    );
  if (!uuidOk) {
    return {
      ok: false,
      mode: "demo",
      error: "Factory project id must be UUID for Supabase persistence",
    };
  }

  const { error } = await supabase.from("factory_projects").upsert(toDbProject(project), {
    onConflict: "id",
  });
  if (error) {
    return { ok: false, mode: "demo", error: error.message };
  }

  // Best-effort outputs table sync. Project row already embeds outputsEmbedded
  // for Free-tier recovery when this call is skipped due to subrequest limits.
  if (project.outputs.length) {
    try {
      const rows = project.outputs.map((o) => {
        const id =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            o.id
          )
            ? o.id
            : crypto.randomUUID();
        if (id !== o.id) o.id = id;
        return {
          id,
          project_id: project.id,
          agent: o.agent,
          schema_name: o.schemaName,
          data: o.data,
          labeled_assumptions: o.labeledAssumptions,
          source: o.source,
          implementation_status: o.implementationStatus,
          created_at: o.createdAt,
        };
      });
      const { error: outErr } = await supabase
        .from("factory_outputs")
        .upsert(rows, { onConflict: "id" });
      if (outErr) {
        // Project embed still saved — treat as ok for Free Worker limits
        project.persistenceMode = "SUPABASE";
        saveMemoryProject(project);
        return {
          ok: true,
          mode: "supabase",
          error: `outputs table sync skipped: ${outErr.message}`,
        };
      }
    } catch (e) {
      project.persistenceMode = "SUPABASE";
      saveMemoryProject(project);
      return {
        ok: true,
        mode: "supabase",
        error: `outputs table sync skipped: ${
          e instanceof Error ? e.message : "unknown"
        }`,
      };
    }
  }

  project.persistenceMode = "SUPABASE";
  saveMemoryProject(project);
  return { ok: true, mode: "supabase" };
}

function memoryIsAhead(mem: FactoryProject, db: FactoryProject): boolean {
  if (mem.tasks.some((t) => t.status === "RUNNING")) return true;
  if (mem.outputs.length > db.outputs.length) return true;
  const memTs = Date.parse(mem.updatedAt) || 0;
  const dbTs = Date.parse(db.updatedAt) || 0;
  if (memTs > dbTs && mem.outputs.length >= db.outputs.length) return true;
  return false;
}

export async function loadFactoryProject(
  id: string
): Promise<{ project: FactoryProject | null; mode: "supabase" | "demo" }> {
  const mem = getMemoryProject(id);
  const status = await getSchemaStatus();
  if (!status.productionPersistence) {
    return { project: mem ?? null, mode: "demo" };
  }

  const supabase = await factoryClient();
  if (!supabase) return { project: mem ?? null, mode: "demo" };

  const { data, error } = await supabase
    .from("factory_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return { project: mem ?? null, mode: "supabase" };
  }

  const { data: outputs } = await supabase
    .from("factory_outputs")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const mappedOutputs: FactoryOutput[] = (outputs || []).map((o) => ({
    id: String(o.id),
    projectId: String(o.project_id),
    agent: o.agent as FactoryOutput["agent"],
    schemaName: String(o.schema_name),
    data: (o.data || {}) as Record<string, unknown>,
    labeledAssumptions: (o.labeled_assumptions || []) as string[],
    source: o.source as FactoryOutput["source"],
    implementationStatus:
      o.implementation_status as FactoryOutput["implementationStatus"],
    createdAt: String(o.created_at),
  }));

  const project = fromDbProject(data as Record<string, unknown>, mappedOutputs);

  // Concurrent GET/list during /run must not clobber an in-flight pipeline
  // (Worker isolates share memory — that wipe caused BUILD plan=undefined).
  if (mem && memoryIsAhead(mem, project)) {
    return { project: mem, mode: "supabase" };
  }

  saveMemoryProject(project);
  return { project, mode: "supabase" };
}

export async function listPersistedFactoryProjects(ownerId?: string): Promise<{
  projects: FactoryProject[];
  mode: "supabase" | "demo";
}> {
  const status = await getSchemaStatus();
  if (!status.productionPersistence) {
    return { projects: listMemoryProjects(ownerId), mode: "demo" };
  }
  const supabase = await factoryClient();
  if (!supabase) {
    return { projects: listMemoryProjects(ownerId), mode: "demo" };
  }
  let q = supabase
    .from("factory_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data, error } = await q;
  if (error || !data) {
    return { projects: listMemoryProjects(ownerId), mode: "demo" };
  }
  const projects = data.map((row) =>
    fromDbProject(row as Record<string, unknown>)
  );
  // Do not overwrite in-memory projects that are mid-pipeline or have richer outputs.
  for (const p of projects) {
    const mem = getMemoryProject(p.id);
    if (mem && memoryIsAhead(mem, p)) continue;
    // Preserve outputs already in memory when list query omits factory_outputs
    if (mem?.outputs?.length && !p.outputs.length) {
      p.outputs = mem.outputs;
    }
    saveMemoryProject(p);
  }
  return { projects, mode: "supabase" };
}
