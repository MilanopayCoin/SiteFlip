/** AI Business Factory — core types (V2 landing + V3 mini-SaaS) */

export type PipelineVersion = "v2" | "v3" | "v4" | "v5";

export type FactoryProjectState =
  | "IDEA"
  | "PLANNING"
  | "RESEARCHING"
  | "DESIGNING"
  | "BUILDING"
  | "TESTING"
  | "PREVIEW"
  | "APPROVAL_REQUIRED"
  | "READY"
  | "DEPLOYING"
  | "LIVE"
  | "FAILED"
  | "PAUSED"
  | "ARCHIVED";

export type FactoryAgentName =
  | "PlannerAgent"
  | "BusinessAgent"
  | "MarketAgent"
  | "BrandAgent"
  | "ProductAgent"
  | "ArchitectureAgent"
  | "SecurityAgent"
  | "DeveloperAgent"
  | "DatabaseAgent"
  | "PaymentAgent"
  | "ContentAgent"
  | "SEOAgent"
  | "TestingAgent"
  | "GrowthAgent"
  | "FinanceAgent"
  | "DeploymentAgent"
  | "PassportAgent"
  | "ScoreAgent";

export type FactoryTaskStatus =
  | "WAITING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "REQUIRES_APPROVAL"
  | "SKIPPED";

export type DeploymentStatus =
  | "NOT_STARTED"
  | "BUILDING"
  | "TESTING"
  | "READY"
  | "DEPLOYING"
  | "LIVE"
  | "FAILED";

/** Visible V2 pipeline stages (landing page) */
export type V2PipelineStepId =
  | "IDEA"
  | "ANALYSIS"
  | "BLUEPRINT"
  | "BRAND"
  | "PRODUCT"
  | "TECH"
  | "LANDING"
  | "PASSPORT"
  | "AI_SCORE"
  | "PREVIEW"
  | "APPROVAL"
  | "READY";

/** Visible V3 pipeline stages (working mini-SaaS) */
export type V3PipelineStepId =
  | "PLAN"
  | "PRODUCT_SPEC"
  | "DATABASE_SPEC"
  | "TECH"
  | "GENERATE"
  | "BUILD"
  | "TEST"
  | "SECURITY_SCAN"
  | "PREVIEW"
  | "APPROVAL"
  | "PASSPORT"
  | "AI_SCORE"
  | "READY";

/**
 * V5 — factory flow through GENERATED APP LIVE, then post-live production roadmap:
 * IDEA → AI GENERATE → SANDBOX → BUILD → TEST → SECURITY → PREVIEW → APPROVAL → LIVE
 * → REAL PRODUCTION ISOLATION → SEPARATE RUNTIME → CUSTOM DOMAIN → MOLLIE → V5 GROWTH
 */
export type V5PipelineStepId =
  | "IDEA"
  | "GENERATE"
  | "SANDBOX"
  | "BUILD"
  | "TEST"
  | "SECURITY"
  | "PREVIEW"
  | "APPROVAL"
  | "LIVE"
  | "PRODUCTION_ISOLATION"
  | "SEPARATE_RUNTIME"
  | "CUSTOM_DOMAIN"
  | "MOLLIE"
  | "GROWTH";

export type PipelineStepId = V2PipelineStepId | V3PipelineStepId | V5PipelineStepId;

/** Post-LIVE V5 roadmap (after GENERATED APP LIVE) */
export const V5_POST_LIVE_STEP_IDS = [
  "PRODUCTION_ISOLATION",
  "SEPARATE_RUNTIME",
  "CUSTOM_DOMAIN",
  "MOLLIE",
  "GROWTH",
] as const satisfies ReadonlyArray<V5PipelineStepId>;

export type V5PostLiveStepId = (typeof V5_POST_LIVE_STEP_IDS)[number];

export type ClaimClass = "VERIFIED" | "USER_PROVIDED" | "AI_HYPOTHESIS";

export type FactoryPersistenceMode = "LOCAL" | "DEMO" | "SUPABASE";

export type FactoryOutputSource =
  | "openai"
  | "groq"
  | "gemini"
  | "ollama"
  | "heuristic";

export interface FactoryBrief {
  idea: string;
  budget: string;
  targetRevenue: string;
  country: string;
  targetCustomer: string;
  businessType: string;
  preferredTechnology?: string;
  experienceLevel?: string;
  availableTime?: string;
  riskLevel?: string;
  businessModel?: string;
  workloadPreference?: string;
}

export interface FactoryTask {
  id: string;
  projectId: string;
  stepId: PipelineStepId;
  agent: FactoryAgentName;
  status: FactoryTaskStatus;
  progress: number;
  activity: string | null;
  error: string | null;
  outputId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  attempt: number;
  maxAttempts: number;
}

export interface FactoryOutput {
  id: string;
  projectId: string;
  agent: FactoryAgentName;
  schemaName: string;
  data: Record<string, unknown>;
  labeledAssumptions: string[];
  source: FactoryOutputSource;
  implementationStatus:
    | "ai_generated"
    | "user_approved"
    | "automatically_implemented"
    | "requires_external_integration"
    | "requires_human_action";
  createdAt: string;
}

export interface FactoryApproval {
  id: string;
  projectId: string;
  action:
    | "production_deploy"
    | "domain_connect"
    | "payment_activation"
    | "paid_service"
    | "database_change"
    | "delete_resources"
    | "publish_legal"
    | "cost_threshold"
    | "change_request"
    | "landing_page_finalize"
    | "marketplace_listing"
    | "publish_listing"
    | "rollback"
    | "connect_domain"
    | "generated_app_live";
  title: string;
  explanation: string;
  services: string[];
  estimatedCostEur: number | null;
  risks: string[];
  status: "PENDING" | "APPROVED" | "EDITED" | "CANCELLED";
  createdAt: string;
  resolvedAt: string | null;
}

export interface FactoryChange {
  id: string;
  projectId: string;
  agent: FactoryAgentName | "User";
  reason: string;
  filesChanged: string[];
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "N/A";
  result: string;
  createdAt: string;
  rollbackOf: string | null;
}

export interface FactoryUsage {
  projectId: string;
  aiTokensEstimated: number;
  aiCostEurEstimated: number;
  aiRequestCount: number;
  buildAttempts: number;
  infrastructureMonthlyEur: number;
  thirdPartyMonthlyEur: number;
  buildCostEur: number;
  budgetLimitEur: number | null;
  costThresholdEur: number;
}

export interface FactoryMemoryEntry {
  id: string;
  projectId: string;
  kind:
    | "business_spec"
    | "brand_rules"
    | "product_spec"
    | "architecture"
    | "technical_decision"
    | "ai_decision"
    | "user_approval"
    | "deployment_history"
    | "growth_plan"
    | "business_passport"
    | "security_review";
  key: string;
  value: Record<string, unknown>;
  createdAt: string;
}

export interface FactorySandbox {
  projectId: string;
  ownerId: string;
  /** Marketplace / business identity (defaults to projectId until linked) */
  businessId?: string | null;
  sandboxId?: string | null;
  runtimeId?: string | null;
  schemaStrategy: "isolated_schema" | "isolated_project";
  storagePrefix: string;
  envConfigKeys: string[];
  buildLogs: string[];
  deploymentStatus: DeploymentStatus;
  previewUrl: string | null;
  productionUrl: string | null;
  /** V4.3 lifecycle */
  lifecycle?: string | null;
  isolationLabel?: string | null;
  isProductionGrade?: boolean;
}

export interface FactoryQualityScore {
  overall: number;
  /** V1 AI Score factors */
  marketClarity: number;
  problemStrength: number;
  businessModel: number;
  competition: number;
  executionComplexity: number;
  growthPotential: number;
  risk: number;
  /** Supporting dimensions */
  businessClarity: number;
  marketFit: number;
  ux: number;
  technicalQuality: number;
  seo: number;
  performance: number;
  security: number;
  monetization: number;
  mobileReadiness: number;
  completeness: number;
  /** Why the score was calculated — never fabricate external data */
  explanations: string[];
}

export interface BusinessPassport {
  businessId: string;
  businessName: string;
  createdAt: string;
  businessModel: string;
  targetCustomer: string;
  technology: string[];
  revenueModel: string;
  aiScore: number | null;
  factoryStatus: FactoryProjectState;
  lifecycle: "BUILDING" | "READY" | "LIVE" | "GROWING" | "LISTED" | "RENTED" | "SOLD" | "REVIVED";
  owner: string;
  timeline: Array<{ at: string; label: string }>;
  persistenceMode: FactoryPersistenceMode;
  persistenceNote: string;
  /** V3/V4 — generated application metadata */
  pipelineVersion?: PipelineVersion;
  applicationVersion?: string;
  features?: string[];
  buildStatus?: string;
  testStatus?: string;
  securityStatus?: string;
  previewUrl?: string | null;
  /** V4 deployment */
  productionUrl?: string | null;
  deploymentStatus?: string;
  deploymentVersion?: string | null;
  lastDeploymentAt?: string | null;
  runtimeStatus?: string;
}

export interface FactoryProject {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  pipelineVersion: PipelineVersion;
  state: FactoryProjectState;
  brief: FactoryBrief;
  currentStep: PipelineStepId | null;
  tasks: FactoryTask[];
  outputs: FactoryOutput[];
  approvals: FactoryApproval[];
  changes: FactoryChange[];
  memory: FactoryMemoryEntry[];
  sandbox: FactorySandbox;
  usage: FactoryUsage;
  quality: FactoryQualityScore | null;
  passport: BusinessPassport | null;
  growthPlan: string[] | null;
  persistenceMode: FactoryPersistenceMode;
  activityLog: Array<{
    id: string;
    at: string;
    agent: string;
    message: string;
    level: "info" | "success" | "error" | "warning";
  }>;
  createdAt: string;
  updatedAt: string;
  liveAt: string | null;
}

export const PIPELINE_STEPS: Array<{
  id: PipelineStepId;
  number: string;
  label: string;
  agent: FactoryAgentName;
  mvp: boolean;
}> = [
  { id: "IDEA", number: "01", label: "IDEA", agent: "BusinessAgent", mvp: true },
  { id: "ANALYSIS", number: "02", label: "ANALYSIS", agent: "MarketAgent", mvp: true },
  { id: "BLUEPRINT", number: "03", label: "BUSINESS BLUEPRINT", agent: "BusinessAgent", mvp: true },
  { id: "BRAND", number: "04", label: "BRAND", agent: "BrandAgent", mvp: true },
  { id: "PRODUCT", number: "05", label: "PRODUCT", agent: "ProductAgent", mvp: true },
  { id: "TECH", number: "06", label: "TECH ARCHITECTURE", agent: "ArchitectureAgent", mvp: true },
  { id: "LANDING", number: "07", label: "LANDING PAGE", agent: "DeveloperAgent", mvp: true },
  { id: "PASSPORT", number: "08", label: "BUSINESS PASSPORT", agent: "PassportAgent", mvp: true },
  { id: "AI_SCORE", number: "09", label: "AI SCORE", agent: "ScoreAgent", mvp: true },
  { id: "PREVIEW", number: "10", label: "PREVIEW", agent: "DeploymentAgent", mvp: true },
  { id: "APPROVAL", number: "11", label: "USER APPROVAL", agent: "DeploymentAgent", mvp: true },
  { id: "READY", number: "12", label: "READY TO LAUNCH", agent: "DeploymentAgent", mvp: true },
];

/** V3 pipeline — IDEA → WORKING MINI-SAAS */
export const V3_PIPELINE_STEPS: Array<{
  id: V3PipelineStepId;
  number: string;
  label: string;
  agent: FactoryAgentName;
  mvp: boolean;
}> = [
  { id: "PLAN", number: "01", label: "PLAN", agent: "PlannerAgent", mvp: true },
  { id: "PRODUCT_SPEC", number: "02", label: "PRODUCT SPEC", agent: "ProductAgent", mvp: true },
  { id: "DATABASE_SPEC", number: "03", label: "DATABASE SPEC", agent: "DatabaseAgent", mvp: true },
  { id: "TECH", number: "04", label: "TECH ARCHITECTURE", agent: "ArchitectureAgent", mvp: true },
  { id: "GENERATE", number: "05", label: "GENERATE", agent: "DeveloperAgent", mvp: true },
  { id: "BUILD", number: "06", label: "BUILD", agent: "DeveloperAgent", mvp: true },
  { id: "TEST", number: "07", label: "TEST", agent: "TestingAgent", mvp: true },
  { id: "SECURITY_SCAN", number: "08", label: "SECURITY SCAN", agent: "SecurityAgent", mvp: true },
  { id: "PREVIEW", number: "09", label: "PREVIEW", agent: "DeploymentAgent", mvp: true },
  { id: "APPROVAL", number: "10", label: "USER APPROVAL", agent: "DeploymentAgent", mvp: true },
  { id: "PASSPORT", number: "11", label: "PASSPORT", agent: "PassportAgent", mvp: true },
  { id: "AI_SCORE", number: "12", label: "AI SCORE", agent: "ScoreAgent", mvp: true },
  { id: "READY", number: "13", label: "READY", agent: "DeploymentAgent", mvp: true },
];

/** V5 pipeline — IDEA → LIVE, then post-live production roadmap */
export const V5_PIPELINE_STEPS: Array<{
  id: V5PipelineStepId;
  number: string;
  label: string;
  agent: FactoryAgentName;
  mvp: boolean;
}> = [
  { id: "IDEA", number: "01", label: "IDEA", agent: "BusinessAgent", mvp: true },
  { id: "GENERATE", number: "02", label: "AI GENERATE", agent: "DeveloperAgent", mvp: true },
  { id: "SANDBOX", number: "03", label: "SANDBOX", agent: "DeploymentAgent", mvp: true },
  { id: "BUILD", number: "04", label: "BUILD", agent: "DeveloperAgent", mvp: true },
  { id: "TEST", number: "05", label: "TEST", agent: "TestingAgent", mvp: true },
  { id: "SECURITY", number: "06", label: "SECURITY", agent: "SecurityAgent", mvp: true },
  { id: "PREVIEW", number: "07", label: "PREVIEW", agent: "DeploymentAgent", mvp: true },
  { id: "APPROVAL", number: "08", label: "APPROVAL", agent: "DeploymentAgent", mvp: true },
  { id: "LIVE", number: "09", label: "GENERATED APP LIVE", agent: "DeploymentAgent", mvp: true },
  {
    id: "PRODUCTION_ISOLATION",
    number: "10",
    label: "REAL PRODUCTION ISOLATION",
    agent: "DeploymentAgent",
    mvp: true,
  },
  {
    id: "SEPARATE_RUNTIME",
    number: "11",
    label: "SEPARATE RUNTIME",
    agent: "DeploymentAgent",
    mvp: true,
  },
  {
    id: "CUSTOM_DOMAIN",
    number: "12",
    label: "CUSTOM DOMAIN",
    agent: "DeploymentAgent",
    mvp: true,
  },
  { id: "MOLLIE", number: "13", label: "MOLLIE", agent: "PaymentAgent", mvp: true },
  { id: "GROWTH", number: "14", label: "V5 GROWTH", agent: "GrowthAgent", mvp: true },
];

export function getPipelineSteps(version: PipelineVersion = "v3") {
  if (version === "v2") return PIPELINE_STEPS;
  if (version === "v5") return V5_PIPELINE_STEPS;
  return V3_PIPELINE_STEPS;
}

/** MVP orchestrator agent order (V1) */
export const MVP_AGENT_ORDER: FactoryAgentName[] = [
  "BusinessAgent",
  "MarketAgent",
  "BrandAgent",
  "ProductAgent",
  "ArchitectureAgent",
  "SecurityAgent",
  "ContentAgent",
  "SEOAgent",
  "DatabaseAgent",
  "PaymentAgent",
  "DeveloperAgent",
  "TestingAgent",
  "DeploymentAgent",
  "GrowthAgent",
  "FinanceAgent",
];
