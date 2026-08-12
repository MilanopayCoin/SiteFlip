/** AI Business Factory V1 — core types */

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

/** Visible V1 pipeline stages */
export type PipelineStepId =
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
    | "publish_listing";
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
  schemaStrategy: "isolated_schema" | "isolated_project";
  storagePrefix: string;
  envConfigKeys: string[];
  buildLogs: string[];
  deploymentStatus: DeploymentStatus;
  previewUrl: string | null;
  productionUrl: string | null;
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
  lifecycle: "BUILDING" | "READY" | "LISTED" | "GROWING" | "SOLD";
  owner: string;
  timeline: Array<{ at: string; label: string }>;
  persistenceMode: FactoryPersistenceMode;
  persistenceNote: string;
}

export interface FactoryProject {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
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
