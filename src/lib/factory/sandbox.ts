/**
 * BusinessSandbox — isolation boundaries for generated businesses.
 * Generated projects must NOT access the core SITEFLIP database.
 */

import type { FactoryProject, FactorySandbox } from "./types";

export type SandboxMode = "production_sandbox" | "development_isolation";

export interface SandboxProvider {
  mode: SandboxMode;
  label: string;
  storagePrefix: string;
  schemaStrategy: FactorySandbox["schemaStrategy"];
  /** Keys that generated code must never reference */
  forbiddenEnvKeys: string[];
  isProductionGrade: boolean;
}

/** True sandbox infrastructure is not available — use safest dev isolation */
export function createSandboxProvider(projectId: string): SandboxProvider {
  return {
    mode: "development_isolation",
    label: "SANDBOX: DEVELOPMENT ISOLATION",
    storagePrefix: `sandboxes/${projectId}/`,
    schemaStrategy: "isolated_schema",
    forbiddenEnvKeys: [
      "MOLLIE_API_KEY",
      "GROQ_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_DB_URL",
      "OPENAI_API_KEY",
      "CLOUDFLARE_API_TOKEN",
      "SITEFLIP_CORE",
    ],
    isProductionGrade: false,
  };
}

export function createSandbox(
  projectId: string,
  ownerId: string
): FactorySandbox {
  const provider = createSandboxProvider(projectId);
  return {
    projectId,
    ownerId,
    schemaStrategy: provider.schemaStrategy,
    storagePrefix: provider.storagePrefix,
    envConfigKeys: [
      "SANDBOX_DATABASE_URL",
      "SANDBOX_MOLLIE_API_KEY",
      "SANDBOX_SUPABASE_URL",
      "SANDBOX_SUPABASE_ANON_KEY",
    ],
    buildLogs: [provider.label],
    deploymentStatus: "NOT_STARTED",
    previewUrl: null,
    productionUrl: null,
  };
}

export function assertSandboxBoundary(project: FactoryProject): void {
  if (!project.sandbox.projectId || project.sandbox.projectId !== project.id) {
    throw new Error("Sandbox boundary violation: project/sandbox ID mismatch");
  }
  if (project.sandbox.storagePrefix.includes("..")) {
    throw new Error("Sandbox boundary violation: invalid storage prefix");
  }
}

/** Blocklist for generated code / commands */
export const FORBIDDEN_PATTERNS = [
  /process\.env\.(SUPABASE_SERVICE_ROLE|MOLLIE_API|OPENAI_API|GROQ_API|CLOUDFLARE)/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_DB_URL/i,
  /MOLLIE_API_KEY/i,
  /GROQ_API_KEY/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /rm\s+-rf\s+\//,
  /SITEFLIP_CORE/i,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /child_process/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /fs\.(unlink|rmdir|rm)Sync/,
  /https?:\/\/.*\.workers\.dev\/(?!preview)/i,
];

export function scanGeneratedContent(content: string): {
  safe: boolean;
  findings: string[];
} {
  const findings: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      findings.push(`Blocked pattern: ${pattern.source}`);
    }
  }
  return { safe: findings.length === 0, findings };
}

export function previewPathFor(projectId: string): string {
  return `/build/${projectId}/preview`;
}
