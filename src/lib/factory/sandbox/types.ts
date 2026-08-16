/**
 * V4.3 Sandbox architecture — types & adapter contracts.
 * Do NOT hard-code a vendor into business logic.
 * Never claim production-grade isolation unless isProductionGrade === true.
 */

export type SandboxVendor = "development_isolation" | "cloudflare_isolate" | "external";

export type SandboxLifecycleStatus =
  | "CREATED"
  | "INSTALLING"
  | "BUILDING"
  | "TESTING"
  | "SECURITY_SCAN"
  | "PREVIEW"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "DESTROYED"
  | "FAILED";

export type ResourceLimitSpec = {
  name: string;
  /** Declared policy value (human-readable) */
  policy: string;
  /** True only when the runtime actually enforces this limit */
  enforced: boolean;
  detail: string;
};

export type SandboxRecord = {
  sandboxId: string;
  businessId: string;
  projectId: string;
  runtimeId: string;
  ownerId: string;
  vendor: SandboxVendor;
  label: string;
  isProductionGrade: boolean;
  lifecycle: SandboxLifecycleStatus;
  storagePrefix: string;
  schemaStrategy: "isolated_schema" | "isolated_project";
  /** Public/sandbox-only env key names allowed in generated apps */
  allowedEnvKeys: string[];
  /** Keys generated apps must never access */
  forbiddenEnvKeys: string[];
  resourceLimits: ResourceLimitSpec[];
  previewUrl: string | null;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  lastError: string | null;
};

export type SandboxStatusSnapshot = {
  sandboxId: string;
  lifecycle: SandboxLifecycleStatus;
  isProductionGrade: boolean;
  label: string;
  previewUrl: string | null;
  resourceLimits: ResourceLimitSpec[];
  enforcedLimitCount: number;
  unenforcedLimitCount: number;
  running: boolean;
};

/**
 * SandboxProvider — vendor-agnostic adapter for isolated execution.
 */
export interface SandboxProvider {
  readonly vendor: SandboxVendor;
  readonly label: string;
  readonly isProductionGrade: boolean;

  createSandbox(input: {
    projectId: string;
    businessId: string;
    ownerId: string;
  }): Promise<SandboxRecord>;

  getSandbox(sandboxId: string): Promise<SandboxRecord | null>;

  startSandbox(sandboxId: string): Promise<SandboxRecord>;

  stopSandbox(sandboxId: string): Promise<SandboxRecord>;

  destroySandbox(sandboxId: string): Promise<SandboxRecord>;

  getStatus(sandboxId: string): Promise<SandboxStatusSnapshot | null>;

  getLogs(sandboxId: string): Promise<string[]>;

  getPreviewUrl(sandboxId: string): Promise<string | null>;

  /** Optional lifecycle helpers used by factory pipeline */
  markPhase?(
    sandboxId: string,
    phase: SandboxLifecycleStatus,
    log?: string
  ): Promise<SandboxRecord>;
}

export const FORBIDDEN_PRODUCTION_SECRET_KEYS = [
  "MOLLIE_API_KEY",
  "GROQ_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_DB",
  "OPENAI_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "MIGRATE_TOKEN",
  "SITEFLIP_CORE",
  "JIY_PRODUCTION_DATABASE",
] as const;

export const SANDBOX_ALLOWED_ENV_KEYS = [
  "SANDBOX_DATABASE_URL",
  "SANDBOX_MOLLIE_API_KEY",
  "SANDBOX_SUPABASE_URL",
  "SANDBOX_SUPABASE_ANON_KEY",
  "PUBLIC_APP_NAME",
  "PUBLIC_APP_URL",
  "BUSINESS_ID",
  "APP_VERSION",
] as const;

/** Declared resource limits — enforced flags must stay honest */
export function declaredResourceLimits(): ResourceLimitSpec[] {
  return [
    {
      name: "cpu_limit",
      policy: "shared Worker CPU — no per-business hard cap",
      enforced: false,
      detail: "Not enforced in DEVELOPMENT ISOLATION (co-hosted Worker)",
    },
    {
      name: "memory_limit",
      policy: "shared Worker memory — no per-business hard cap",
      enforced: false,
      detail: "Not enforced in DEVELOPMENT ISOLATION",
    },
    {
      name: "execution_timeout",
      policy: "sandbox auto-stop after PREVIEW phase",
      enforced: true,
      detail: "Lifecycle STOP is invoked after preview; sandbox must not stay RUNNING",
    },
    {
      name: "build_timeout",
      policy: "DeploymentProvider build/deploy timeouts",
      enforced: true,
      detail: "Build/deploy steps use timeout handling in DeploymentProvider",
    },
    {
      name: "filesystem_limit",
      policy: "in-memory factory outputs only — no host FS writes",
      enforced: true,
      detail: "Generated apps stored as factory outputs; not written into JIY core tree",
    },
    {
      name: "network_policy",
      policy: "deny production secret egress; no dedicated network jail",
      enforced: false,
      detail: "Static scan only — OS/network jail not available in DEVELOPMENT ISOLATION",
    },
    {
      name: "dependency_limits",
      policy: "scaffold dependency allowlist in generator",
      enforced: false,
      detail: "Declared in generator; not runtime-enforced package firewall",
    },
  ];
}
