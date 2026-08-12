import type { BusinessPassport, FactoryProject } from "./types";
import { getOutputByAgent } from "./store";
import type {
  ArchitectureSpec,
  CodeArtifact,
  PlanSpec,
  ProductSpec,
  SecurityScan,
  TestReport,
} from "./schemas";

export function buildBusinessPassport(project: FactoryProject): BusinessPassport {
  const isV3 = project.pipelineVersion === "v3";
  const planSpec = isV3
    ? (getOutputByAgent(project, "PlannerAgent")?.data as PlanSpec | undefined)
    : undefined;
  const plan = getOutputByAgent(project, "BusinessAgent")?.data as
    | { businessName?: string; businessModel?: string; targetCustomer?: string; revenueModel?: string }
    | undefined;
  const arch = getOutputByAgent(project, "ArchitectureAgent")?.data as
    | ArchitectureSpec
    | undefined;
  const product = getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;
  const tests = getOutputByAgent(project, "TestingAgent")?.data as
    | TestReport
    | undefined;
  const security = getOutputByAgent(project, "SecurityAgent")?.data as
    | SecurityScan
    | undefined;

  const lifecycle =
    project.state === "LIVE"
      ? "GROWING"
      : project.state === "READY" || project.state === "APPROVAL_REQUIRED"
        ? "READY"
        : "BUILDING";

  const timeline = [
    { at: project.createdAt, label: "Factory project created" },
    ...project.activityLog
      .filter((a) => a.level === "success")
      .slice(0, 8)
      .reverse()
      .map((a) => ({ at: a.at, label: `${a.agent}: ${a.message}` })),
  ];
  if (project.liveAt) {
    timeline.push({ at: project.liveAt, label: "Marked LIVE (sandbox)" });
  }

  const testStatus = tests
    ? tests.passed
      ? "PASS"
      : tests.requiresHumanApproval
        ? "REQUIRES_HUMAN_REVIEW"
        : "FAIL"
    : "NOT RUN";

  const securityStatus = security
    ? security.passed
      ? "PASS"
      : security.requiresApproval
        ? "REQUIRES_APPROVAL"
        : "FAIL"
    : "NOT RUN";

  return {
    businessId: project.id,
    businessName:
      planSpec?.businessName || plan?.businessName || project.name,
    createdAt: project.createdAt,
    businessModel:
      planSpec?.businessModel || plan?.businessModel || project.brief.businessType,
    targetCustomer:
      planSpec?.targetCustomer || plan?.targetCustomer || project.brief.targetCustomer,
    technology: arch?.techStack?.length
      ? arch.techStack
      : project.brief.preferredTechnology?.split(/,\s*/) || [],
    revenueModel:
      planSpec?.revenueModel || plan?.revenueModel || "Not specified",
    aiScore: project.quality?.overall ?? null,
    factoryStatus: project.state,
    lifecycle,
    owner: project.ownerId,
    timeline,
    persistenceMode: project.persistenceMode,
    persistenceNote:
      project.persistenceMode === "SUPABASE"
        ? "Persisted to Supabase factory tables"
        : "LOCAL / DEMO / NOT PERSISTED — in-memory factory store only. Data may be lost on redeploy.",
    pipelineVersion: project.pipelineVersion,
    applicationVersion: isV3 ? "v3-starter-mvp" : "v2-landing",
    features: product?.mvpFeatures ?? planSpec?.mvpPages ?? [],
    buildStatus: project.sandbox.deploymentStatus,
    testStatus,
    securityStatus,
    previewUrl: project.sandbox.previewUrl,
  };
}
