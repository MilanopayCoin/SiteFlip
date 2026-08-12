/**
 * BusinessSandbox — isolation boundaries for generated businesses.
 * Generated projects must NOT access the core SITEFLIP database.
 */

import type { FactoryProject, FactorySandbox } from "./types";

export function createSandbox(
  projectId: string,
  ownerId: string
): FactorySandbox {
  return {
    projectId,
    ownerId,
    schemaStrategy: "isolated_schema",
    storagePrefix: `sandboxes/${projectId}/`,
    envConfigKeys: [
      "SANDBOX_DATABASE_URL",
      "SANDBOX_MOLLIE_API_KEY",
      "SANDBOX_SUPABASE_URL",
      "SANDBOX_SUPABASE_ANON_KEY",
    ],
    buildLogs: [],
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
  /process\.env\.(SUPABASE_SERVICE_ROLE|MOLLIE_API|OPENAI_API|GROQ_API)/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /rm\s+-rf\s+\//,
  /SITEFLIP_CORE/i,
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
