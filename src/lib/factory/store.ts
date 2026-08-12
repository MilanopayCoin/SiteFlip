/**
 * In-memory factory store for MVP.
 * Swap for Supabase factory_* tables when configured.
 * No secrets stored as plaintext.
 */

import { nanoid } from "nanoid";
import type {
  FactoryApproval,
  FactoryBrief,
  FactoryChange,
  FactoryMemoryEntry,
  FactoryOutput,
  FactoryProject,
  FactoryQualityScore,
  FactoryTask,
  FactoryTaskStatus,
  PipelineStepId,
} from "./types";
import { PIPELINE_STEPS } from "./types";

const globalStore = globalThis as unknown as {
  __siteflipFactoryProjects?: Map<string, FactoryProject>;
};

function projects(): Map<string, FactoryProject> {
  if (!globalStore.__siteflipFactoryProjects) {
    globalStore.__siteflipFactoryProjects = new Map();
  }
  return globalStore.__siteflipFactoryProjects;
}

export function listFactoryProjects(ownerId?: string): FactoryProject[] {
  const all = Array.from(projects().values());
  const filtered = ownerId ? all.filter((p) => p.ownerId === ownerId) : all;
  return filtered.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getFactoryProject(id: string): FactoryProject | undefined {
  return projects().get(id);
}

export function saveFactoryProject(project: FactoryProject): FactoryProject {
  project.updatedAt = new Date().toISOString();
  projects().set(project.id, project);
  return project;
}

export function createFactoryProject(
  brief: FactoryBrief,
  ownerId = "demo-user"
): FactoryProject {
  const id = `fp_${nanoid(10)}`;
  const now = new Date().toISOString();
  const slug = `project-${id.slice(3, 9)}`;

  const tasks: FactoryTask[] = PIPELINE_STEPS.map((step) => ({
    id: `task_${nanoid(8)}`,
    projectId: id,
    stepId: step.id,
    agent: step.agent,
    status: "WAITING" as FactoryTaskStatus,
    progress: 0,
    activity: null,
    error: null,
    outputId: null,
    startedAt: null,
    completedAt: null,
    attempt: 0,
    maxAttempts: 3,
  }));

  // IDEA + BUSINESS both use BusinessAgent — keep discrete steps
  const project: FactoryProject = {
    id,
    ownerId,
    name: "Untitled Factory Project",
    slug,
    state: "IDEA",
    brief,
    currentStep: "IDEA",
    tasks,
    outputs: [],
    approvals: [],
    changes: [],
    memory: [],
    sandbox: {
      projectId: id,
      ownerId,
      schemaStrategy: "isolated_schema",
      storagePrefix: `sandboxes/${id}/`,
      envConfigKeys: [
        "NEXT_PUBLIC_APP_URL",
        "MOLLIE_API_KEY",
        "SUPABASE_URL",
      ],
      buildLogs: [],
      deploymentStatus: "NOT_STARTED",
      previewUrl: null,
      productionUrl: null,
    },
    usage: {
      projectId: id,
      aiTokensEstimated: 0,
      aiCostEurEstimated: 0,
      infrastructureMonthlyEur: 0,
      thirdPartyMonthlyEur: 0,
      buildCostEur: 0,
      budgetLimitEur: null,
      costThresholdEur: 10,
    },
    quality: null,
    passport: null,
    growthPlan: null,
    persistenceMode: "LOCAL",
    activityLog: [
      {
        id: nanoid(8),
        at: now,
        agent: "Orchestrator",
        message:
          "Factory project created (LOCAL / DEMO / NOT PERSISTED). Waiting to run pipeline.",
        level: "info",
      },
    ],
    createdAt: now,
    updatedAt: now,
    liveAt: null,
  };

  return saveFactoryProject(project);
}

export function appendActivity(
  project: FactoryProject,
  agent: string,
  message: string,
  level: "info" | "success" | "error" | "warning" = "info"
) {
  project.activityLog.unshift({
    id: nanoid(8),
    at: new Date().toISOString(),
    agent,
    message,
    level,
  });
  // keep last 100
  project.activityLog = project.activityLog.slice(0, 100);
}

export function addOutput(
  project: FactoryProject,
  output: Omit<FactoryOutput, "id" | "createdAt">
): FactoryOutput {
  const full: FactoryOutput = {
    ...output,
    id: `out_${nanoid(10)}`,
    createdAt: new Date().toISOString(),
  };
  project.outputs.push(full);
  return full;
}

export function addMemory(
  project: FactoryProject,
  entry: Omit<FactoryMemoryEntry, "id" | "createdAt">
) {
  project.memory.push({
    ...entry,
    id: `mem_${nanoid(8)}`,
    createdAt: new Date().toISOString(),
  });
}

export function addChange(
  project: FactoryProject,
  change: Omit<FactoryChange, "id" | "createdAt">
) {
  project.changes.push({
    ...change,
    id: `chg_${nanoid(8)}`,
    createdAt: new Date().toISOString(),
  });
}

export function addApproval(
  project: FactoryProject,
  approval: Omit<FactoryApproval, "id" | "createdAt" | "resolvedAt" | "status">
): FactoryApproval {
  const full: FactoryApproval = {
    ...approval,
    id: `apr_${nanoid(8)}`,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  project.approvals.push(full);
  return full;
}

export function updateTask(
  project: FactoryProject,
  stepId: PipelineStepId,
  patch: Partial<FactoryTask>
) {
  const task = project.tasks.find((t) => t.stepId === stepId);
  if (!task) return;
  Object.assign(task, patch);
}

export function getOutputByAgent(
  project: FactoryProject,
  agent: string
): FactoryOutput | undefined {
  return [...project.outputs].reverse().find((o) => o.agent === agent);
}

export function setQuality(project: FactoryProject, quality: FactoryQualityScore) {
  project.quality = quality;
}

export function factoryPortfolioStats(ownerId = "demo-user") {
  const items = listFactoryProjects(ownerId);
  return {
    activeBuilds: items.filter((p) =>
      [
        "IDEA",
        "PLANNING",
        "RESEARCHING",
        "DESIGNING",
        "BUILDING",
        "TESTING",
        "PREVIEW",
        "APPROVAL_REQUIRED",
        "READY",
        "DEPLOYING",
      ].includes(p.state)
    ).length,
    completed: items.filter((p) => p.state === "LIVE").length,
    growing: items.filter((p) => p.state === "LIVE").length,
    forSale: 0,
    rented: 0,
    revived: 0,
    portfolioValueEur: items.reduce((s, p) => {
      const fin = getOutputByAgent(p, "FinanceAgent");
      const v = fin?.data?.businessValueEstimateEur;
      return s + (typeof v === "number" ? v : 0);
    }, 0),
    projects: items,
  };
}
