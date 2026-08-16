/**
 * DevelopmentIsolationSandboxAdapter — safest available sandbox today.
 * HONEST: isProductionGrade = false. Not a production isolation runtime.
 */

import { nanoid } from "nanoid";
import type {
  SandboxProvider,
  SandboxRecord,
  SandboxStatusSnapshot,
  SandboxLifecycleStatus,
} from "./types";
import {
  FORBIDDEN_PRODUCTION_SECRET_KEYS,
  SANDBOX_ALLOWED_ENV_KEYS,
  declaredResourceLimits,
} from "./types";

const globalStore = globalThis as unknown as {
  __jiySandboxes?: Map<string, SandboxRecord>;
};

function sandboxes(): Map<string, SandboxRecord> {
  if (!globalStore.__jiySandboxes) {
    globalStore.__jiySandboxes = new Map();
  }
  return globalStore.__jiySandboxes;
}

function touch(record: SandboxRecord): SandboxRecord {
  record.updatedAt = new Date().toISOString();
  sandboxes().set(record.sandboxId, record);
  return record;
}

function requireSandbox(sandboxId: string): SandboxRecord {
  const record = sandboxes().get(sandboxId);
  if (!record) throw new Error(`Sandbox not found: ${sandboxId}`);
  if (record.lifecycle === "DESTROYED") {
    throw new Error(`Sandbox destroyed: ${sandboxId}`);
  }
  return record;
}

export class DevelopmentIsolationSandboxAdapter implements SandboxProvider {
  readonly vendor = "development_isolation" as const;
  readonly label = "SANDBOX: DEVELOPMENT ISOLATION";
  readonly isProductionGrade = false;

  async createSandbox(input: {
    projectId: string;
    businessId: string;
    ownerId: string;
  }): Promise<SandboxRecord> {
    const now = new Date().toISOString();
    const sandboxId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sb_${nanoid(16)}`;
    const runtimeId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `rt_${nanoid(12)}`;

    const record: SandboxRecord = {
      sandboxId,
      businessId: input.businessId,
      projectId: input.projectId,
      runtimeId,
      ownerId: input.ownerId,
      vendor: this.vendor,
      label: this.label,
      isProductionGrade: false,
      lifecycle: "CREATED",
      storagePrefix: `sandboxes/${input.projectId}/${sandboxId}/`,
      schemaStrategy: "isolated_schema",
      allowedEnvKeys: [...SANDBOX_ALLOWED_ENV_KEYS],
      forbiddenEnvKeys: [...FORBIDDEN_PRODUCTION_SECRET_KEYS],
      resourceLimits: declaredResourceLimits(),
      previewUrl: null,
      logs: [
        this.label,
        `Sandbox created sandboxId=${sandboxId}`,
        `businessId=${input.businessId} projectId=${input.projectId} runtimeId=${runtimeId}`,
        "NOT production-grade isolation — PRODUCTION ISOLATION REQUIRED for LIVE deploy",
      ],
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      stoppedAt: null,
      lastError: null,
    };
    sandboxes().set(sandboxId, record);
    return record;
  }

  async getSandbox(sandboxId: string): Promise<SandboxRecord | null> {
    return sandboxes().get(sandboxId) ?? null;
  }

  async startSandbox(sandboxId: string): Promise<SandboxRecord> {
    const record = requireSandbox(sandboxId);
    if (record.lifecycle === "STOPPED") {
      record.stoppedAt = null;
    }
    record.lifecycle = "INSTALLING";
    record.startedAt = new Date().toISOString();
    record.logs.push("Sandbox started — INSTALL phase");
    return touch(record);
  }

  async stopSandbox(sandboxId: string): Promise<SandboxRecord> {
    const record = requireSandbox(sandboxId);
    record.lifecycle = "STOPPED";
    record.stoppedAt = new Date().toISOString();
    record.logs.push("Sandbox STOPPED — must not remain RUNNING indefinitely");
    return touch(record);
  }

  async destroySandbox(sandboxId: string): Promise<SandboxRecord> {
    const record = requireSandbox(sandboxId);
    record.lifecycle = "DESTROYED";
    record.stoppedAt = record.stoppedAt || new Date().toISOString();
    record.previewUrl = null;
    record.logs.push("Sandbox DESTROYED");
    return touch(record);
  }

  async getStatus(sandboxId: string): Promise<SandboxStatusSnapshot | null> {
    const record = await this.getSandbox(sandboxId);
    if (!record) return null;
    const enforced = record.resourceLimits.filter((l) => l.enforced).length;
    return {
      sandboxId: record.sandboxId,
      lifecycle: record.lifecycle,
      isProductionGrade: record.isProductionGrade,
      label: record.label,
      previewUrl: record.previewUrl,
      resourceLimits: record.resourceLimits,
      enforcedLimitCount: enforced,
      unenforcedLimitCount: record.resourceLimits.length - enforced,
      running: ["INSTALLING", "BUILDING", "TESTING", "SECURITY_SCAN", "PREVIEW", "RUNNING"].includes(
        record.lifecycle
      ),
    };
  }

  async getLogs(sandboxId: string): Promise<string[]> {
    const record = await this.getSandbox(sandboxId);
    return record?.logs ?? [];
  }

  async getPreviewUrl(sandboxId: string): Promise<string | null> {
    const record = await this.getSandbox(sandboxId);
    return record?.previewUrl ?? null;
  }

  async markPhase(
    sandboxId: string,
    phase: SandboxLifecycleStatus,
    log?: string
  ): Promise<SandboxRecord> {
    const record = requireSandbox(sandboxId);
    record.lifecycle = phase;
    if (log) record.logs.push(log);
    else record.logs.push(`Lifecycle → ${phase}`);
    if (phase === "PREVIEW") {
      record.previewUrl = `/generated/${record.projectId}`;
      record.logs.push("SANDBOX PREVIEW ready — durable /generated runtime");
    }
    if (phase === "FAILED") {
      record.lastError = log || "Sandbox phase failed";
    }
    return touch(record);
  }
}

/** Default provider factory — swap when a production-grade adapter exists */
export function getSandboxProvider(): SandboxProvider {
  return new DevelopmentIsolationSandboxAdapter();
}

export function listSandboxesForProject(projectId: string): SandboxRecord[] {
  return Array.from(sandboxes().values()).filter((s) => s.projectId === projectId);
}
