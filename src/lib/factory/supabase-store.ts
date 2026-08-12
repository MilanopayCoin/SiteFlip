/**
 * Factory project persistence to Supabase when schema is ready.
 * Source of truth: factory_projects + factory_outputs (+ runs).
 * Never stores secrets. Never claims persistence without DB writes.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";
import type { FactoryProject, FactoryOutput, FactoryPersistenceMode } from "./types";
import {
  getFactoryProject as getMemoryProject,
  saveFactoryProject as saveMemoryProject,
  listFactoryProjects as listMemoryProjects,
} from "./store";

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
    outputs,
    approvals: (sandbox.approvals as FactoryProject["approvals"]) || [],
    changes: (sandbox.changes as FactoryProject["changes"]) || [],
    memory: (sandbox.memory as FactoryProject["memory"]) || [],
    sandbox: {
      projectId: String(row.id),
      ownerId: String(row.owner_id),
      schemaStrategy: "isolated_schema",
      storagePrefix: `sandboxes/${row.id}/`,
      envConfigKeys: [],
      buildLogs: ((sandbox as { buildLogs?: string[] }).buildLogs) || [],
      deploymentStatus:
        ((sandbox as { deploymentStatus?: FactoryProject["sandbox"]["deploymentStatus"] })
          .deploymentStatus) || "NOT_STARTED",
      previewUrl: (sandbox as { previewUrl?: string | null }).previewUrl ?? null,
      productionUrl:
        (sandbox as { productionUrl?: string | null }).productionUrl ?? null,
      ...(sandbox as object),
    } as FactoryProject["sandbox"],
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

  const supabase = await createServiceClient();
  if (!supabase) {
    return { ok: false, mode: "demo", error: "Service role unavailable" };
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

  // Replace outputs for this project (simple strategy)
  await supabase.from("factory_outputs").delete().eq("project_id", project.id);
  if (project.outputs.length) {
    const rows = project.outputs.map((o) => ({
      id: /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : undefined,
      project_id: project.id,
      agent: o.agent,
      schema_name: o.schemaName,
      data: o.data,
      labeled_assumptions: o.labeledAssumptions,
      source: o.source,
      implementation_status: o.implementationStatus,
      created_at: o.createdAt,
    }));
    const { error: outErr } = await supabase.from("factory_outputs").insert(rows);
    if (outErr) {
      return { ok: false, mode: "demo", error: outErr.message };
    }
  }

  // Record a run snapshot
  await supabase.from("factory_runs").insert({
    project_id: project.id,
    status: project.state,
    finished_at: new Date().toISOString(),
  });

  project.persistenceMode = "SUPABASE";
  saveMemoryProject(project);
  return { ok: true, mode: "supabase" };
}

export async function loadFactoryProject(
  id: string
): Promise<{ project: FactoryProject | null; mode: "supabase" | "demo" }> {
  const mem = getMemoryProject(id);
  const status = await getSchemaStatus();
  if (!status.productionPersistence) {
    return { project: mem ?? null, mode: "demo" };
  }

  const supabase = await createServiceClient();
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
  const supabase = await createServiceClient();
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
  for (const p of projects) saveMemoryProject(p);
  return { projects, mode: "supabase" };
}
