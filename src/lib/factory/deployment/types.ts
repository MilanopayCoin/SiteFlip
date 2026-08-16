/**
 * DeploymentProvider — adapter architecture for deploying generated businesses.
 * Do NOT hard-code Cloudflare into business logic.
 */

export type DeploymentRuntimeStatus =
  | "NOT_DEPLOYED"
  | "BUILDING"
  | "DEPLOYING"
  | "VERIFYING"
  | "LIVE"
  | "FAILED"
  | "ROLLBACK_REQUIRED";

export type DomainStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "CONNECTED"
  | "FAILED";

export interface BusinessRuntimeConfig {
  PUBLIC_APP_NAME: string;
  PUBLIC_APP_URL: string;
  BUSINESS_ID: string;
  APP_VERSION: string;
  /** Never include production secrets */
  label: "AI GENERATED STARTER";
}

export interface DeploymentRecord {
  deploymentId: string;
  projectId: string;
  businessId: string;
  version: string;
  status: DeploymentRuntimeStatus;
  previewUrl: string | null;
  productionUrl: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  healthCheckPassed: boolean | null;
  isolationPassed: boolean;
  notes: string[];
  error: string | null;
  provider: string;
}

export interface DomainRecord {
  domain: string;
  status: DomainStatus;
  cnameTarget: string | null;
  txtVerification: string | null;
  verifiedAt: string | null;
  notes: string[];
}

export interface IsolationCheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    status: "pass" | "fail" | "unknown";
    detail: string;
  }>;
  blockProduction: boolean;
  message: string;
}

export interface DeploymentProvider {
  readonly name: string;
  createProject(input: {
    projectId: string;
    businessId: string;
    name: string;
  }): Promise<{ projectRef: string }>;
  buildProject(input: {
    projectId: string;
    version: string;
  }): Promise<{ ok: boolean; logs: string[] }>;
  deployProject(input: {
    projectId: string;
    businessId: string;
    version: string;
    config: BusinessRuntimeConfig;
    environment: "preview" | "production";
  }): Promise<DeploymentRecord>;
  getDeploymentStatus(deploymentId: string): Promise<DeploymentRecord | null>;
  getPreviewUrl(projectId: string): Promise<string | null>;
  getProductionUrl(projectId: string): Promise<string | null>;
  rollbackDeployment(input: {
    projectId: string;
    targetDeploymentId: string;
  }): Promise<DeploymentRecord>;
  verifyDeployment(deploymentId: string): Promise<{
    ok: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  }>;
}
