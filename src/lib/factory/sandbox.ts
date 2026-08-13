/**
 * Public sandbox module — backward-compatible exports + V4.3 adapters.
 */

export type {
  SandboxProvider,
  SandboxRecord,
  SandboxStatusSnapshot,
  SandboxLifecycleStatus,
  SandboxVendor,
  ResourceLimitSpec,
} from "./sandbox/types";
export {
  FORBIDDEN_PRODUCTION_SECRET_KEYS,
  SANDBOX_ALLOWED_ENV_KEYS,
  declaredResourceLimits,
} from "./sandbox/types";
export {
  getSandboxProvider,
  DevelopmentIsolationSandboxAdapter,
  listSandboxesForProject,
} from "./sandbox/development-adapter";
export {
  ProductionSandboxProvider,
  tryGetProductionSandboxProvider,
} from "./sandbox/production-provider";
export {
  provisionProjectSandbox,
  startProjectSandbox,
  stopProjectSandbox,
  runSandboxPhase,
  applySandboxRecordToProject,
  initialFactorySandbox,
} from "./sandbox/service";

import type { FactoryProject, FactorySandbox } from "./types";
import { getSandboxProvider } from "./sandbox/development-adapter";
import { FORBIDDEN_PRODUCTION_SECRET_KEYS } from "./sandbox/types";
import { initialFactorySandbox } from "./sandbox/service";

/** @deprecated use SandboxProvider from getSandboxProvider() — kept for V3/V4 callers */
export type SandboxMode = "production_sandbox" | "development_isolation";

/** Legacy shape used by older orchestrator calls */
export interface LegacySandboxProviderInfo {
  mode: SandboxMode;
  label: string;
  storagePrefix: string;
  schemaStrategy: FactorySandbox["schemaStrategy"];
  forbiddenEnvKeys: string[];
  isProductionGrade: boolean;
}

export function createSandboxProvider(projectId: string): LegacySandboxProviderInfo {
  const provider = getSandboxProvider();
  return {
    mode: provider.isProductionGrade ? "production_sandbox" : "development_isolation",
    label: provider.label,
    storagePrefix: `sandboxes/${projectId}/`,
    schemaStrategy: "isolated_schema",
    forbiddenEnvKeys: [...FORBIDDEN_PRODUCTION_SECRET_KEYS],
    isProductionGrade: provider.isProductionGrade,
  };
}

export function createSandbox(
  projectId: string,
  ownerId: string
): FactorySandbox {
  return initialFactorySandbox(projectId, ownerId);
}

export function assertSandboxBoundary(project: FactoryProject): void {
  if (!project.sandbox.projectId || project.sandbox.projectId !== project.id) {
    throw new Error("Sandbox boundary violation: project/sandbox ID mismatch");
  }
  if (project.sandbox.storagePrefix.includes("..")) {
    throw new Error("Sandbox boundary violation: invalid storage prefix");
  }
  if (
    project.sandbox.sandboxId &&
    project.sandbox.businessId &&
    project.sandbox.businessId !== project.id &&
    project.sandbox.businessId !== project.sandbox.projectId
  ) {
    // businessId defaults to projectId until marketplace business row exists
  }
}

/** Blocklist for generated code / commands */
export const FORBIDDEN_PATTERNS = [
  /process\.env\.(SUPABASE_SERVICE_ROLE|MOLLIE_API|OPENAI_API|GROQ_API|CLOUDFLARE)/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_DB_URL/i,
  /SUPABASE_DB\b/i,
  /MOLLIE_API_KEY/i,
  /GROQ_API_KEY/i,
  /CLOUDFLARE_API_TOKEN/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /rm\s+-rf\s+\//,
  /SITEFLIP_CORE/i,
  /JIY_PRODUCTION_DATABASE/i,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /child_process/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /fs\.(unlink|rmdir|rm)Sync/,
  /https?:\/\/.*\.workers\.dev\/(?!preview)/i,
];

export function scanGeneratedContent(content: string | null | undefined): {
  safe: boolean;
  findings: string[];
} {
  const findings: string[] = [];
  const text = typeof content === "string" ? content : "";
  if (!text) return { safe: true, findings };
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`Blocked pattern: ${pattern.source}`);
    }
  }
  return { safe: findings.length === 0, findings };
}

export function previewPathFor(projectId: string): string {
  return `/preview/${projectId}`;
}
