/** AI Business Factory — core types */

export type FactoryProjectState =
  | "IDEA"
  | "PLANNING"
  | "RESEARCHING"
  | "DESIGNING"
  | "BUILDING"
  | "TESTING"
  | "PREVIEW"
  | "APPROVAL_REQUIRED"
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
  | "DeveloperAgent"
  | "DatabaseAgent"
  | "PaymentAgent"
  | "ContentAgent"
  | "SEOAgent"
  | "TestingAgent"
  | "GrowthAgent"
  | "FinanceAgent"
  | "DeploymentAgent";

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

export type PipelineStepId =
  | "IDEA"
  | "MARKET"
  | "BUSINESS"
  | "BRAND"
  | "PRODUCT"
  | "CODE"
  | "DATABASE"
  | "PAYMENTS"
  | "SEO"
  | "TEST"
  | "DEPLOY"
  | "LIVE";

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
  source: "openai" | "heuristic";
  /** AI-generated | user-approved | auto-implemented | needs-integration | needs-human */
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
    | "change_request";
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
    | "growth_plan";
  key: string;
  value: Record<string, unknown>;
  createdAt: string;
  /** Never store secrets here */
}

export interface FactorySandbox {
  projectId: string;
  ownerId: string;
  schemaStrategy: "isolated_schema" | "isolated_project";
  storagePrefix: string;
  envConfigKeys: string[]; // names only — never values
  buildLogs: string[];
  deploymentStatus: DeploymentStatus;
  previewUrl: string | null;
  productionUrl: string | null;
}

export interface FactoryQualityScore {
  overall: number;
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
  growthPlan: string[] | null;
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
  { id: "MARKET", number: "02", label: "MARKET", agent: "MarketAgent", mvp: true },
  { id: "BUSINESS", number: "03", label: "BUSINESS", agent: "BusinessAgent", mvp: true },
  { id: "BRAND", number: "04", label: "BRAND", agent: "BrandAgent", mvp: true },
  { id: "PRODUCT", number: "05", label: "PRODUCT", agent: "ProductAgent", mvp: true },
  { id: "CODE", number: "06", label: "CODE", agent: "DeveloperAgent", mvp: true },
  { id: "DATABASE", number: "07", label: "DATABASE", agent: "DatabaseAgent", mvp: true },
  { id: "PAYMENTS", number: "08", label: "PAYMENTS", agent: "PaymentAgent", mvp: true },
  { id: "SEO", number: "09", label: "SEO", agent: "SEOAgent", mvp: true },
  { id: "TEST", number: "10", label: "TEST", agent: "TestingAgent", mvp: true },
  { id: "DEPLOY", number: "11", label: "DEPLOY", agent: "DeploymentAgent", mvp: true },
  { id: "LIVE", number: "12", label: "LIVE", agent: "DeploymentAgent", mvp: true },
];

/** MVP orchestrator order (ContentAgent runs between Product and Code for landing copy) */
export const MVP_AGENT_ORDER: FactoryAgentName[] = [
  "BusinessAgent",
  "MarketAgent",
  "BrandAgent",
  "ProductAgent",
  "ArchitectureAgent",
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
