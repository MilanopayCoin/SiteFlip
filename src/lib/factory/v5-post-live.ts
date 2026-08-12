/**
 * V5 post-LIVE roadmap gates (after GENERATED APP LIVE).
 *
 * REAL PRODUCTION ISOLATION → SEPARATE RUNTIME → CUSTOM DOMAIN → MOLLIE → V5 GROWTH
 *
 * Cloudflare Free: isolation + separate runtime are blocked honestly.
 * Domain / Mollie / Growth can progress only after prior gates allow them.
 */

import type {
  FactoryProject,
  FactoryTaskStatus,
  V5PostLiveStepId,
} from "./types";
import { V5_POST_LIVE_STEP_IDS, V5_PIPELINE_STEPS } from "./types";
import {
  appendActivity,
  getFactoryProject,
  saveFactoryProject,
  updateTask,
  addOutput,
  addMemory,
} from "./store";
import { getRuntimeIsolationProvider } from "./deployment/isolation";
import { getOutputByAgent } from "./store";
import type { CodeArtifact } from "./schemas";
import { tryGetProductionSandboxProvider } from "./sandbox/production-provider";
import { listDomains } from "./deployment";
import { isMollieConfigured } from "../payments/mollie";
import { prepareGrowthRecommendations } from "./growth-engine";
import { ensureCloudflareEnv } from "../supabase/env";

export type V5PostLiveGateStatus =
  | "YOU_ARE_HERE"
  | "LOCKED"
  | "AVAILABLE"
  | "BLOCKED"
  | "COMPLETED"
  | "NOT_STARTED";

export type V5PostLiveGate = {
  id: V5PostLiveStepId;
  label: string;
  status: V5PostLiveGateStatus;
  taskStatus: FactoryTaskStatus | "MISSING";
  activity: string | null;
  blockers: string[];
  note: string;
};

export type V5PostLiveSnapshot = {
  projectId: string;
  live: boolean;
  currentMarker: "LIVE" | V5PostLiveStepId | "COMPLETE";
  youAreHereLabel: string;
  gates: V5PostLiveGate[];
  nextActionable: V5PostLiveStepId | null;
  isolationAvailable: boolean;
  separateRuntimeAvailable: boolean;
};

function labelFor(id: V5PostLiveStepId): string {
  return V5_PIPELINE_STEPS.find((s) => s.id === id)?.label || id;
}

function taskOf(project: FactoryProject, id: V5PostLiveStepId) {
  return project.tasks.find((t) => t.stepId === id);
}

function isCompleted(status: FactoryTaskStatus | undefined) {
  return status === "COMPLETED";
}

export function getV5PostLiveSnapshot(project: FactoryProject): V5PostLiveSnapshot {
  const liveDone =
    project.state === "LIVE" ||
    isCompleted(project.tasks.find((t) => t.stepId === "LIVE")?.status);

  const isolationProvider = tryGetProductionSandboxProvider();
  const isolationAvailable = Boolean(
    isolationProvider?.isProductionGrade === true
  );
  const separateRuntimeAvailable = isolationAvailable;

  const code = getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const isolationCheck = getRuntimeIsolationProvider().checkIsolation({
    projectId: project.id,
    code: code ?? null,
    sandboxId: project.sandbox.sandboxId,
    runtimeId: project.sandbox.runtimeId,
    businessId: project.sandbox.businessId,
  });

  const domains = listDomains(project.id);
  const domainVerified = domains.some(
    (d) => d.status === "VERIFIED" || d.status === "CONNECTED"
  );
  const mollieApproved = project.approvals.some(
    (a) => a.action === "payment_activation" && a.status === "APPROVED"
  );
  const mollieConfigured = isMollieConfigured();
  const growthDone = isCompleted(taskOf(project, "GROWTH")?.status);

  const isolationDone =
    isCompleted(taskOf(project, "PRODUCTION_ISOLATION")?.status) &&
    isolationAvailable &&
    !isolationCheck.blockProduction;
  const runtimeDone =
    isCompleted(taskOf(project, "SEPARATE_RUNTIME")?.status) &&
    separateRuntimeAvailable;
  const domainDone =
    isCompleted(taskOf(project, "CUSTOM_DOMAIN")?.status) || domainVerified;
  const mollieDone =
    isCompleted(taskOf(project, "MOLLIE")?.status) ||
    (mollieConfigured && mollieApproved);

  const gates: V5PostLiveGate[] = V5_POST_LIVE_STEP_IDS.map((id) => {
    const task = taskOf(project, id);
    const taskStatus = task?.status ?? "MISSING";
    const blockers: string[] = [];
    let status: V5PostLiveGateStatus = "NOT_STARTED";
    let note = "";

    if (!liveDone) {
      status = "LOCKED";
      note = "Reach GENERATED APP LIVE first";
      blockers.push("LIVE required");
    } else if (id === "PRODUCTION_ISOLATION") {
      if (isolationDone) {
        status = "COMPLETED";
        note = "Production-grade isolation verified";
      } else if (!isolationAvailable || isolationCheck.blockProduction) {
        status = "BLOCKED";
        note =
          "PRODUCTION ISOLATION REQUIRED — Cloudflare Free has no separate Worker / resource jail for generated apps";
        blockers.push("PRODUCTION ISOLATION REQUIRED");
        if (!isolationAvailable) blockers.push("Production sandbox provider not provisioned");
      } else {
        status = "AVAILABLE";
        note = "Isolation provider ready — run gate check";
      }
    } else if (id === "SEPARATE_RUNTIME") {
      if (!isolationDone && !isolationAvailable) {
        status = "LOCKED";
        note = "Requires REAL PRODUCTION ISOLATION first";
        blockers.push("PRODUCTION_ISOLATION");
      } else if (runtimeDone) {
        status = "COMPLETED";
        note = "Separate runtime identity provisioned";
      } else {
        status = "BLOCKED";
        note =
          "SEPARATE RUNTIME not available on Cloudflare Free — would need Workers for Platforms / per-business Worker";
        blockers.push("SEPARATE RUNTIME NOT PROVISIONED");
      }
    } else if (id === "CUSTOM_DOMAIN") {
      if (domainDone) {
        status = "COMPLETED";
        note = "Domain verified or connected";
      } else if (!isolationDone) {
        // Platform DNS is usable before production isolation — not a separate runtime bind
        status = "AVAILABLE";
        note =
          "Platform DNS verify available now. Binding to a SEPARATE RUNTIME still needs production isolation.";
      } else {
        status = "AVAILABLE";
        note = "Add + verify domain in Deployment panel, then re-check this gate";
      }
    } else if (id === "MOLLIE") {
      if (mollieDone) {
        status = "COMPLETED";
        note = "Mollie configured + payment activation approved (not escrow)";
      } else {
        status = "AVAILABLE";
        note = !mollieConfigured
          ? "Configure Mollie Worker secret, then approve payment activation"
          : "Approve payment activation for this project (Mollie ≠ escrow)";
        if (!mollieConfigured) blockers.push("Mollie not configured");
        if (!mollieApproved) blockers.push("payment_activation not approved");
      }
    } else {
      // GROWTH — draft recommendations never auto-apply
      if (growthDone) {
        status = "COMPLETED";
        note = "V5 growth recommendations prepared (auto-apply = false)";
      } else {
        status = "AVAILABLE";
        note =
          "Prepare V5 growth recommendations (never auto-applies). Production growth automation still needs isolation.";
      }
    }

    if (taskStatus === "COMPLETED" && status !== "BLOCKED") {
      status = "COMPLETED";
    }

    return {
      id,
      label: labelFor(id),
      status,
      taskStatus,
      activity: task?.activity ?? null,
      blockers,
      note,
    };
  });

  // Marker: stay on GENERATED APP LIVE until post-live roadmap completes.
  // Next focus is the first incomplete post-live gate (usually PRODUCTION_ISOLATION).
  let currentMarker: V5PostLiveSnapshot["currentMarker"] = "LIVE";
  let youAreHereLabel = "GENERATED APP LIVE";
  if (liveDone) {
    const allDone = gates.every((g) => g.status === "COMPLETED");
    if (allDone) {
      currentMarker = "COMPLETE";
      youAreHereLabel = "V5 POST-LIVE COMPLETE";
    } else {
      currentMarker = "LIVE";
      youAreHereLabel = "GENERATED APP LIVE";
      const next = gates.find((g) => g.status !== "COMPLETED");
      if (next && (next.status === "BLOCKED" || next.status === "AVAILABLE")) {
        // Annotate next focus without moving the YOU ARE HERE pin off LIVE
        next.note = `NEXT ← ${next.note}`;
      }
    }
  }

  const nextActionable =
    gates.find((g) => g.status === "AVAILABLE" || g.status === "BLOCKED")?.id ??
    null;

  return {
    projectId: project.id,
    live: liveDone,
    currentMarker: liveDone ? currentMarker : "LIVE",
    youAreHereLabel: liveDone
      ? youAreHereLabel
      : "Not LIVE yet — finish APPROVAL → GENERATED APP LIVE",
    gates,
    nextActionable,
    isolationAvailable,
    separateRuntimeAvailable,
  };
}

export async function attemptV5PostLiveGate(
  projectId: string,
  stepId: V5PostLiveStepId
): Promise<{
  project: FactoryProject;
  snapshot: V5PostLiveSnapshot;
  ok: boolean;
  message: string;
}> {
  await ensureCloudflareEnv();
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Factory project not found");
  if (project.pipelineVersion !== "v5") {
    throw new Error("Post-live gates are V5-only");
  }

  const before = getV5PostLiveSnapshot(project);
  const gate = before.gates.find((g) => g.id === stepId);
  if (!gate) throw new Error("Unknown post-live gate");

  if (!before.live) {
    return {
      project,
      snapshot: before,
      ok: false,
      message: "Reach GENERATED APP LIVE first",
    };
  }

  if (gate.status === "LOCKED") {
    return {
      project,
      snapshot: before,
      ok: false,
      message: gate.note || "Gate locked — complete prior steps",
    };
  }

  updateTask(project, stepId, {
    status: "RUNNING",
    progress: 30,
    activity: `Attempting ${gate.label}…`,
    startedAt: new Date().toISOString(),
    error: null,
  });
  appendActivity(project, "DeploymentAgent", `Post-live gate: ${stepId}`, "info");
  saveFactoryProject(project);

  if (stepId === "PRODUCTION_ISOLATION") {
    const provider = tryGetProductionSandboxProvider();
    const code = getOutputByAgent(project, "DeveloperAgent")?.data as
      | CodeArtifact
      | undefined;
    const check = getRuntimeIsolationProvider().checkIsolation({
      projectId,
      code: code ?? null,
      sandboxId: project.sandbox.sandboxId,
      runtimeId: project.sandbox.runtimeId,
    });
    const ok = Boolean(provider?.isProductionGrade) && !check.blockProduction;
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "REQUIRES_APPROVAL",
      progress: 100,
      activity: ok
        ? "REAL PRODUCTION ISOLATION verified"
        : "BLOCKED — PRODUCTION ISOLATION REQUIRED (Cloudflare Free / no separate Worker)",
      completedAt: new Date().toISOString(),
      error: ok ? null : check.message,
    });
    appendActivity(
      project,
      "DeploymentAgent",
      ok
        ? "Production isolation PASS"
        : "Production isolation BLOCKED — stay on DEVELOPMENT ISOLATION",
      ok ? "success" : "warning"
    );
    saveFactoryProject(project);
    const refreshed = getFactoryProject(projectId)!;
    return {
      project: refreshed,
      snapshot: getV5PostLiveSnapshot(refreshed),
      ok,
      message: ok
        ? "REAL PRODUCTION ISOLATION complete"
        : check.message || "PRODUCTION ISOLATION REQUIRED",
    };
  }

  if (stepId === "SEPARATE_RUNTIME") {
    const provider = tryGetProductionSandboxProvider();
    const ok = Boolean(provider?.isProductionGrade);
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "REQUIRES_APPROVAL",
      progress: 100,
      activity: ok
        ? "Separate runtime provisioned"
        : "BLOCKED — SEPARATE RUNTIME not available on Cloudflare Free",
      completedAt: new Date().toISOString(),
      error: ok ? null : "SEPARATE RUNTIME NOT PROVISIONED",
    });
    appendActivity(
      project,
      "DeploymentAgent",
      ok ? "Separate runtime PASS" : "Separate runtime BLOCKED",
      ok ? "success" : "warning"
    );
    saveFactoryProject(project);
    const refreshed = getFactoryProject(projectId)!;
    return {
      project: refreshed,
      snapshot: getV5PostLiveSnapshot(refreshed),
      ok,
      message: ok
        ? "SEPARATE RUNTIME complete"
        : "SEPARATE RUNTIME requires production isolation provider",
    };
  }

  if (stepId === "CUSTOM_DOMAIN") {
    const domains = listDomains(projectId);
    const ok = domains.some(
      (d) => d.status === "VERIFIED" || d.status === "CONNECTED"
    );
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "REQUIRES_APPROVAL",
      progress: 100,
      activity: ok
        ? `Domain ready (${domains.map((d) => d.domain).join(", ")})`
        : "Add + verify a domain in the Deployment panel, then retry",
      completedAt: new Date().toISOString(),
      error: ok ? null : "No verified domain",
    });
    appendActivity(
      project,
      "DeploymentAgent",
      ok ? "CUSTOM DOMAIN gate PASS" : "CUSTOM DOMAIN waiting on DNS verify",
      ok ? "success" : "info"
    );
    saveFactoryProject(project);
    const refreshed = getFactoryProject(projectId)!;
    return {
      project: refreshed,
      snapshot: getV5PostLiveSnapshot(refreshed),
      ok,
      message: ok
        ? "CUSTOM DOMAIN complete"
        : "Verify a domain first (Deployment → Add domain → Verify)",
    };
  }

  if (stepId === "MOLLIE") {
    const configured = isMollieConfigured();
    const approved = project.approvals.some(
      (a) => a.action === "payment_activation" && a.status === "APPROVED"
    );
    const ok = configured && approved;
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "REQUIRES_APPROVAL",
      progress: 100,
      activity: ok
        ? "Mollie ready (payment processor — NOT escrow)"
        : !configured
          ? "Mollie secret missing on Worker"
          : "Approve payment activation on this project",
      completedAt: new Date().toISOString(),
      error: ok ? null : "Mollie gate incomplete",
    });
    appendActivity(
      project,
      "PaymentAgent",
      ok ? "MOLLIE gate PASS" : "MOLLIE gate incomplete",
      ok ? "success" : "warning"
    );
    saveFactoryProject(project);
    const refreshed = getFactoryProject(projectId)!;
    return {
      project: refreshed,
      snapshot: getV5PostLiveSnapshot(refreshed),
      ok,
      message: ok
        ? "MOLLIE complete — not escrow; ownership does not auto-transfer"
        : "Configure Mollie + approve payment activation",
    };
  }

  // GROWTH
  const growth = prepareGrowthRecommendations(projectId);
  addOutput(project, {
    projectId: project.id,
    agent: "GrowthAgent",
    schemaName: "V5GrowthRecommendations",
    data: growth as unknown as Record<string, unknown>,
    labeledAssumptions: [
      growth.note,
      "autoApply=false — never mutates production automatically",
      `metrics=${growth.metrics.label}`,
    ],
    source: "heuristic",
    implementationStatus: "requires_human_action",
  });
  addMemory(project, {
    projectId: project.id,
    kind: "growth_plan",
    key: "v5_growth",
    value: growth as unknown as Record<string, unknown>,
  });
  updateTask(project, "GROWTH", {
    status: "COMPLETED",
    progress: 100,
    activity: "V5 GROWTH recommendations ready (approval required to apply)",
    completedAt: new Date().toISOString(),
  });
  appendActivity(
    project,
    "GrowthAgent",
    "V5 GROWTH plan prepared — no auto production changes",
    "success"
  );
  saveFactoryProject(project);
  const refreshed = getFactoryProject(projectId)!;
  return {
    project: refreshed,
    snapshot: getV5PostLiveSnapshot(refreshed),
    ok: true,
    message: "V5 GROWTH recommendations prepared",
  };
}

/** After LIVE — mark post-live steps WAITING and set marker activity */
export function unlockV5PostLiveRoadmap(project: FactoryProject): void {
  for (const id of V5_POST_LIVE_STEP_IDS) {
    updateTask(project, id, {
      status: "WAITING",
      progress: 0,
      activity:
        id === "PRODUCTION_ISOLATION"
          ? "NEXT — REAL PRODUCTION ISOLATION (currently blocked on Cloudflare Free)"
          : "Locked until prior post-live gate passes",
      error: null,
    });
  }
  project.currentStep = "PRODUCTION_ISOLATION";
  appendActivity(
    project,
    "Orchestrator",
    "GENERATED APP LIVE reached — next roadmap: REAL PRODUCTION ISOLATION → SEPARATE RUNTIME → CUSTOM DOMAIN → MOLLIE → V5 GROWTH",
    "info"
  );
}
