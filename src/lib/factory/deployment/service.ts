/**
 * Deployment service — orchestrates deploy / verify / rollback for factory projects.
 */

import { getFactoryProject, saveFactoryProject, appendActivity, addApproval } from "../store";
import { getOutputByAgent } from "../store";
import type { CodeArtifact, SecurityScan, TestReport } from "../schemas";
import { getDeploymentProvider, listDeploymentsForProject } from "./cloudflare-provider";
import { getRuntimeIsolationProvider } from "./isolation";
import { createBusinessRuntimeConfig } from "./runtime-config";
import { createBusinessDatabaseProvider } from "./database-provider";
import type { DeploymentRecord } from "./types";
import { buildBusinessPassport } from "../passport";

export async function canDeployProduction(projectId: string): Promise<{
  ok: boolean;
  blockers: string[];
}> {
  const project = getFactoryProject(projectId);
  const blockers: string[] = [];
  if (!project) return { ok: false, blockers: ["Project not found"] };

  const code = getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const tests = getOutputByAgent(project, "TestingAgent")?.data as
    | TestReport
    | undefined;
  const security = getOutputByAgent(project, "SecurityAgent")?.data as
    | SecurityScan
    | undefined;

  if (!code) blockers.push("BUILD: no generated application");
  if (!tests?.passed) blockers.push("TEST: must PASS");
  if (security && !security.passed) blockers.push("SECURITY: must PASS");

  const isolation = getRuntimeIsolationProvider().checkIsolation({
    projectId,
    code: code ?? null,
    sandboxId: project.sandbox.sandboxId,
    runtimeId: project.sandbox.runtimeId,
    businessId: project.sandbox.businessId || project.id,
  });
  if (isolation.blockProduction || !getRuntimeIsolationProvider().isProductionSafe({
    projectId,
    code: code ?? null,
    sandboxId: project.sandbox.sandboxId,
    runtimeId: project.sandbox.runtimeId,
    businessId: project.sandbox.businessId || project.id,
  })) {
    blockers.push("ISOLATION: PRODUCTION ISOLATION REQUIRED");
  }
  if (!isolation.passed) {
    blockers.push("ISOLATION: isolation checks failed");
  }

  const db = createBusinessDatabaseProvider();
  if (db.isProductionConnected()) {
    blockers.push("DATABASE: unexpected production connection");
  }

  return { ok: blockers.length === 0, blockers };
}

export async function deployPreview(projectId: string): Promise<{
  deployment: DeploymentRecord;
  blocked: boolean;
}> {
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Project not found");

  const provider = getDeploymentProvider();
  await provider.createProject({
    projectId: project.id,
    businessId: project.id,
    name: project.name,
  });

  const version = `v4-${Date.now()}`;
  const config = createBusinessRuntimeConfig({
    appName: project.name,
    businessId: project.id,
    version,
    publicUrl: `/build/${project.id}/preview`,
  });

  const deployment = await provider.deployProject({
    projectId: project.id,
    businessId: project.id,
    version,
    config,
    environment: "preview",
  });

  project.sandbox.previewUrl = deployment.previewUrl;
  project.sandbox.deploymentStatus =
    deployment.status === "LIVE"
      ? "READY"
      : deployment.status === "FAILED"
        ? "FAILED"
        : "DEPLOYING";
  project.sandbox.buildLogs.push(...deployment.notes);
  project.passport = buildBusinessPassport(project);
  appendActivity(
    project,
    "DeploymentAgent",
    deployment.status === "LIVE"
      ? `Preview LIVE — ${deployment.deploymentId}`
      : `Preview deploy ${deployment.status}: ${deployment.error || "in progress"}`,
    deployment.status === "LIVE" ? "success" : "warning"
  );
  saveFactoryProject(project);

  return { deployment, blocked: false };
}

export async function deployProduction(projectId: string): Promise<{
  deployment: DeploymentRecord;
  blocked: boolean;
  blockers: string[];
}> {
  const gate = await canDeployProduction(projectId);
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Project not found");

  // Always attempt through provider — provider also blocks production
  const provider = getDeploymentProvider();
  const version = `v4-prod-${Date.now()}`;
  const config = createBusinessRuntimeConfig({
    appName: project.name,
    businessId: project.id,
    version,
    publicUrl: `https://${project.slug}.jiy.app`,
  });

  if (!gate.ok) {
    appendActivity(
      project,
      "DeploymentAgent",
      `PRODUCTION DEPLOY BLOCKED: ${gate.blockers.join("; ")}`,
      "error"
    );
    saveFactoryProject(project);

    const blockedRecord: DeploymentRecord = {
      deploymentId: `dep_blocked_${Date.now()}`,
      projectId,
      businessId: project.id,
      version,
      status: "FAILED",
      previewUrl: project.sandbox.previewUrl,
      productionUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedAt: null,
      healthCheckPassed: false,
      isolationPassed: false,
      notes: gate.blockers,
      error: "PRODUCTION ISOLATION REQUIRED",
      provider: provider.name,
    };

    return { deployment: blockedRecord, blocked: true, blockers: gate.blockers };
  }

  const deployment = await provider.deployProject({
    projectId: project.id,
    businessId: project.id,
    version,
    config,
    environment: "production",
  });

  if (deployment.status === "LIVE" && deployment.productionUrl) {
    project.state = "LIVE";
    project.liveAt = new Date().toISOString();
    project.sandbox.productionUrl = deployment.productionUrl;
    project.sandbox.deploymentStatus = "LIVE";
  } else {
    appendActivity(
      project,
      "DeploymentAgent",
      `Production deploy ${deployment.status}: ${deployment.error || "see notes"}`,
      "error"
    );
  }

  project.passport = buildBusinessPassport(project);
  saveFactoryProject(project);

  return {
    deployment,
    blocked: deployment.status !== "LIVE",
    blockers: deployment.notes.filter((n) =>
      /ISOLATION|BLOCK|FAILED|REQUIRED/i.test(n)
    ),
  };
}

export async function rollbackProject(
  projectId: string,
  targetDeploymentId: string,
  opts?: { approved?: boolean }
): Promise<DeploymentRecord> {
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Project not found");

  const rollbackTitle = `Approve rollback to ${targetDeploymentId}`;
  const approved = project.approvals.find(
    (a) =>
      a.action === "change_request" &&
      a.title.includes("Rollback") &&
      a.title.includes(targetDeploymentId) &&
      a.status === "APPROVED"
  );
  const pending = project.approvals.find(
    (a) =>
      a.action === "change_request" &&
      a.title.includes("Rollback") &&
      a.title.includes(targetDeploymentId) &&
      a.status === "PENDING"
  );

  if (opts?.approved || approved) {
    // proceed
  } else if (pending) {
    throw new Error("Rollback approval not granted — approve the pending request first");
  } else {
    addApproval(project, {
      projectId,
      action: "change_request",
      title: rollbackTitle,
      explanation: `Rollback to deployment ${targetDeploymentId} requires explicit approval. After rollback, verification must pass before LIVE.`,
      services: ["DeploymentProvider"],
      estimatedCostEur: 0,
      risks: ["Temporary downtime", "Version mismatch"],
    });
    appendActivity(project, "DeploymentAgent", "Rollback requires approval", "warning");
    saveFactoryProject(project);
    throw new Error("Rollback requires approval — approve the pending request first");
  }

  const provider = getDeploymentProvider();
  const result = await provider.rollbackDeployment({
    projectId,
    targetDeploymentId,
  });

  appendActivity(
    project,
    "DeploymentAgent",
    `Rollback ${result.status}: ${result.deploymentId}`,
    result.status === "LIVE" ? "success" : "error"
  );
  if (result.status === "LIVE" && result.previewUrl) {
    project.sandbox.previewUrl = result.previewUrl;
    project.sandbox.deploymentStatus = "READY";
  }
  project.passport = buildBusinessPassport(project);
  saveFactoryProject(project);
  return result;
}

export function getProjectDeployments(projectId: string): DeploymentRecord[] {
  return listDeploymentsForProject(projectId);
}
