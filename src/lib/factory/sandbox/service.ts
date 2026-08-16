/**
 * Sandbox service — factory-facing lifecycle helpers (vendor-agnostic).
 */

import { getSandboxProvider, listSandboxesForProject } from "./development-adapter";
import type { SandboxRecord, SandboxLifecycleStatus } from "./types";
import type { FactoryProject, FactorySandbox } from "../types";

export async function provisionProjectSandbox(
  project: FactoryProject
): Promise<SandboxRecord> {
  const provider = getSandboxProvider();
  const existing = listSandboxesForProject(project.id).find(
    (s) => s.lifecycle !== "DESTROYED"
  );
  if (existing) return existing;

  const businessId = project.id;
  const record = await provider.createSandbox({
    projectId: project.id,
    businessId,
    ownerId: project.ownerId,
  });

  applySandboxRecordToProject(project, record);
  return record;
}

export function applySandboxRecordToProject(
  project: FactoryProject,
  record: SandboxRecord
): void {
  const previousPreview =
    project.sandbox.previewUrl || record.previewUrl || null;
  project.sandbox = {
    ...project.sandbox,
    projectId: project.id,
    ownerId: project.ownerId,
    businessId: record.businessId,
    sandboxId: record.sandboxId,
    runtimeId: record.runtimeId,
    schemaStrategy: record.schemaStrategy,
    storagePrefix: record.storagePrefix,
    envConfigKeys: record.allowedEnvKeys,
    buildLogs: [
      ...(project.sandbox.buildLogs || []),
      ...record.logs,
    ].slice(-40),
    deploymentStatus: project.sandbox.deploymentStatus,
    // Prefer durable /generated runtime URL when already attached
    previewUrl: previousPreview?.startsWith("/generated/")
      ? previousPreview
      : record.previewUrl || previousPreview,
    productionUrl: null,
    lifecycle: record.lifecycle,
    isolationLabel: record.label,
    isProductionGrade: record.isProductionGrade,
    createMode: project.sandbox.createMode,
    runtimeArtifact: project.sandbox.runtimeArtifact ?? null,
  };
}

export async function runSandboxPhase(
  project: FactoryProject,
  phase: SandboxLifecycleStatus,
  log?: string
): Promise<SandboxRecord> {
  const provider = getSandboxProvider();
  const sandboxId = project.sandbox.sandboxId;
  if (!sandboxId) {
    const created = await provisionProjectSandbox(project);
    if (provider.markPhase) {
      const updated = await provider.markPhase(created.sandboxId, phase, log);
      applySandboxRecordToProject(project, updated);
      return updated;
    }
    return created;
  }
  if (!provider.markPhase) {
    throw new Error("Sandbox provider does not support phase marking");
  }
  const updated = await provider.markPhase(sandboxId, phase, log);
  applySandboxRecordToProject(project, updated);
  return updated;
}

export async function startProjectSandbox(
  project: FactoryProject
): Promise<SandboxRecord> {
  const provider = getSandboxProvider();
  let sandboxId = project.sandbox.sandboxId;
  if (!sandboxId) {
    const created = await provisionProjectSandbox(project);
    sandboxId = created.sandboxId;
  }
  const started = await provider.startSandbox(sandboxId);
  applySandboxRecordToProject(project, started);
  return started;
}

export async function stopProjectSandbox(
  project: FactoryProject
): Promise<SandboxRecord | null> {
  const sandboxId = project.sandbox.sandboxId;
  if (!sandboxId) return null;
  const provider = getSandboxProvider();
  const stopped = await provider.stopSandbox(sandboxId);
  applySandboxRecordToProject(project, stopped);
  project.sandbox.deploymentStatus =
    project.sandbox.deploymentStatus === "FAILED" ? "FAILED" : "READY";
  return stopped;
}

export function initialFactorySandbox(
  projectId: string,
  ownerId: string
): FactorySandbox {
  return {
    projectId,
    ownerId,
    businessId: projectId,
    sandboxId: null,
    runtimeId: null,
    schemaStrategy: "isolated_schema",
    storagePrefix: `sandboxes/${projectId}/`,
    envConfigKeys: [
      "SANDBOX_DATABASE_URL",
      "SANDBOX_MOLLIE_API_KEY",
      "SANDBOX_SUPABASE_URL",
      "SANDBOX_SUPABASE_ANON_KEY",
      "PUBLIC_APP_NAME",
      "PUBLIC_APP_URL",
      "BUSINESS_ID",
      "APP_VERSION",
    ],
    buildLogs: ["SANDBOX: DEVELOPMENT ISOLATION — awaiting provision"],
    deploymentStatus: "NOT_STARTED",
    previewUrl: null,
    productionUrl: null,
    lifecycle: null,
    isolationLabel: "SANDBOX: DEVELOPMENT ISOLATION",
    isProductionGrade: false,
  };
}
