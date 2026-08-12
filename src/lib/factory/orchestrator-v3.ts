/**
 * BusinessFactoryOrchestrator V3 — IDEA → WORKING MINI-SAAS
 * Modular agents with Zod-validated outputs.
 * Never auto-deploys. Never infinite RUNNING states.
 */

import type {
  FactoryAgentName,
  FactoryProject,
  FactoryProjectState,
  V3PipelineStepId,
} from "./types";
import {
  addApproval,
  addChange,
  addMemory,
  addOutput,
  appendActivity,
  getFactoryProject,
  getOutputByAgent,
  saveFactoryProject,
  setQuality,
  updateTask,
} from "./store";
import { assertSandboxBoundary, createSandboxProvider, previewPathFor } from "./sandbox";
import { computeFactoryQuality, estimateAgentCost } from "./quality";
import { buildBusinessPassport } from "./passport";
import {
  runArchitectureAgent,
  runDatabaseAgent,
  runDeploymentAgent,
  runFinanceAgent,
  runGrowthAgent,
  runProductAgent,
} from "./agents";
import { runPlannerAgent, planToBusinessPlan } from "./agents/planner";
import { runDeveloperAgentV3 } from "./agents/developer-v3";
import { runTestingAgentV3 } from "./agents/testing-v3";
import { runSecurityScanAgent } from "./agents/security-scan";
import type {
  ArchitectureSpec,
  CodeArtifact,
  DatabaseSpec,
  PlanSpec,
  ProductSpec,
} from "./schemas";

const STATE_FOR_AGENT: Partial<Record<FactoryAgentName, FactoryProjectState>> = {
  PlannerAgent: "PLANNING",
  ProductAgent: "DESIGNING",
  DatabaseAgent: "BUILDING",
  ArchitectureAgent: "DESIGNING",
  DeveloperAgent: "BUILDING",
  TestingAgent: "TESTING",
  SecurityAgent: "TESTING",
  DeploymentAgent: "PREVIEW",
  PassportAgent: "PREVIEW",
  ScoreAgent: "PREVIEW",
  GrowthAgent: "PREVIEW",
  FinanceAgent: "PREVIEW",
};

const V3_AGENTS_COST: FactoryAgentName[] = [
  "PlannerAgent",
  "ProductAgent",
  "DatabaseAgent",
  "ArchitectureAgent",
  "DeveloperAgent",
  "TestingAgent",
  "SecurityAgent",
  "DeploymentAgent",
  "GrowthAgent",
  "FinanceAgent",
];

export class BusinessFactoryOrchestratorV3 {
  constructor(private projectId: string) {}

  get project(): FactoryProject {
    const p = getFactoryProject(this.projectId);
    if (!p) throw new Error("Factory project not found");
    return p;
  }

  async runPipeline(): Promise<FactoryProject> {
    let project = this.project;
    assertSandboxBoundary(project);

    if (project.state === "PAUSED") {
      appendActivity(project, "Orchestrator", "Pipeline is paused", "warning");
      return saveFactoryProject(project);
    }

    project.usage.buildAttempts += 1;
    appendActivity(project, "Orchestrator", "Factory V3 mini-SaaS pipeline started", "info");
    project.state = "PLANNING";
    saveFactoryProject(project);

    const projectedAi = V3_AGENTS_COST.reduce(
      (sum, agent) => sum + estimateAgentCost(agent).costEur,
      0
    );

    if (projectedAi > project.usage.costThresholdEur) {
      const existing = project.approvals.find(
        (a) => a.action === "cost_threshold" && a.status === "PENDING"
      );
      if (!existing) {
        addApproval(project, {
          projectId: project.id,
          action: "cost_threshold",
          title: "Estimated build cost exceeds threshold",
          explanation: `Estimated AI cost ≈ €${projectedAi.toFixed(2)} exceeds threshold €${project.usage.costThresholdEur}. Approve to continue. ESTIMATED BUILD COST — not a verified invoice.`,
          services: ["Configured AI provider (Groq preferred)"],
          estimatedCostEur: projectedAi,
          risks: ["Token spend", "Incomplete build if cancelled"],
        });
        project.state = "APPROVAL_REQUIRED";
        updateTask(project, "APPROVAL", {
          status: "REQUIRES_APPROVAL",
          progress: 100,
          activity: "Cost threshold approval required",
        });
        return saveFactoryProject(project);
      }
      if (existing.status !== "APPROVED") {
        project.state = "APPROVAL_REQUIRED";
        return saveFactoryProject(project);
      }
    }

    try {
      await this.runPlanner();
      await this.runProductSpec();
      await this.runDatabaseSpec();
      await this.runTechArchitecture();
      await this.runGenerate();
      await this.runBuild();
      const { testsOk, requiresHumanReview } = await this.runTests();
      const { securityOk, requiresSecurityApproval } = await this.runSecurityScan();

      const canPreview = testsOk && securityOk;
      await this.runDeployment(canPreview);

      await this.buildPassport();
      await this.computeScore();
      await this.runGrowth();
      await this.runFinance();

      project = this.project;
      project.sandbox.previewUrl = previewPathFor(project.id);
      project.sandbox.deploymentStatus = canPreview ? "READY" : "FAILED";

      if (canPreview) {
        this.addStandardApprovals(project);
        updateTask(project, "APPROVAL", {
          status: "REQUIRES_APPROVAL",
          progress: 100,
          activity: "Awaiting user approvals",
          completedAt: new Date().toISOString(),
        });
        updateTask(project, "READY", {
          status: "WAITING",
          progress: 0,
          activity: "Ready after approvals",
        });
        updateTask(project, "PREVIEW", {
          status: "COMPLETED",
          progress: 100,
          activity: "AI GENERATED STARTER preview ready",
          completedAt: new Date().toISOString(),
        });
        project.state = "APPROVAL_REQUIRED";
        project.currentStep = "APPROVAL";
      } else if (requiresHumanReview || requiresSecurityApproval) {
        project.state = "APPROVAL_REQUIRED";
        project.currentStep = requiresHumanReview ? "TEST" : "SECURITY_SCAN";
        if (requiresHumanReview) {
          addApproval(project, {
            projectId: project.id,
            action: "change_request",
            title: "Testing failed — REQUIRES_HUMAN_REVIEW",
            explanation:
              "Automatic repair loop exhausted (max 3 attempts). Review test report and approve retry or request changes.",
            services: ["TestingAgent", "DeveloperAgent"],
            estimatedCostEur: estimateAgentCost("DeveloperAgent").costEur,
            risks: ["Broken starter MVP", "Incomplete workflows"],
          });
        }
        if (requiresSecurityApproval) {
          addApproval(project, {
            projectId: project.id,
            action: "change_request",
            title: "Security scan requires approval",
            explanation:
              "Generated code failed security scan. Review findings before proceeding to production deploy or database connection.",
            services: ["SecurityAgent"],
            estimatedCostEur: 0,
            risks: ["Unsafe patterns in generated code"],
          });
        }
      } else {
        project.state = "FAILED";
      }

      appendActivity(
        project,
        "Orchestrator",
        canPreview
          ? "V3 pipeline complete — AI GENERATED STARTER preview ready"
          : "V3 pipeline finished with failures — review required",
        canPreview ? "success" : "error"
      );
      return saveFactoryProject(project);
    } catch (error) {
      project = this.project;
      this.failAllRunningTasks(project, error);
      project.state = "FAILED";
      appendActivity(
        project,
        "Orchestrator",
        error instanceof Error ? error.message : "Pipeline failed",
        "error"
      );
      return saveFactoryProject(project);
    }
  }

  private failAllRunningTasks(project: FactoryProject, error: unknown) {
    const msg = error instanceof Error ? error.message : "Pipeline failed";
    for (const task of project.tasks) {
      if (task.status === "RUNNING") {
        updateTask(project, task.stepId, {
          status: "FAILED",
          progress: 100,
          activity: msg,
          completedAt: new Date().toISOString(),
          error: msg,
        });
      }
    }
  }

  private trackCost(agent: FactoryAgentName) {
    const project = this.project;
    const cost = estimateAgentCost(agent);
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiRequestCount += 1;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    project.usage.buildCostEur = project.usage.aiCostEurEstimated;
    saveFactoryProject(project);
  }

  private begin(agent: FactoryAgentName, stepId: V3PipelineStepId) {
    const project = this.project;
    project.state = STATE_FOR_AGENT[agent] ?? project.state;
    project.currentStep = stepId;
    updateTask(project, stepId, {
      status: "RUNNING",
      progress: 10,
      activity: `${agent} running…`,
      startedAt: new Date().toISOString(),
      error: null,
      attempt: (project.tasks.find((t) => t.stepId === stepId)?.attempt ?? 0) + 1,
    });
    appendActivity(project, agent, "Running", "info");
    this.trackCost(agent);
  }

  private finish(
    agent: FactoryAgentName,
    stepId: V3PipelineStepId,
    outputId: string | null,
    ok: boolean,
    error?: string
  ) {
    const project = this.project;
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "FAILED",
      progress: 100,
      activity: ok ? `${agent} completed` : `${agent} failed`,
      completedAt: new Date().toISOString(),
      outputId: outputId ?? null,
      error: error ?? null,
    });
    appendActivity(
      project,
      agent,
      ok ? "Completed" : `Failed: ${error}`,
      ok ? "success" : "error"
    );
    if (outputId) {
      addChange(project, {
        projectId: project.id,
        agent,
        reason: `${agent} output`,
        filesChanged: [],
        approvalStatus: "N/A",
        result: ok ? "success" : error ?? "failed",
        rollbackOf: null,
      });
    }
    saveFactoryProject(project);
  }

  private async runPlanner() {
    this.begin("PlannerAgent", "PLAN");
    const project = this.project;
    const result = await runPlannerAgent(project.brief);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "PlannerAgent",
      schemaName: "PlanSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.name = result.data.businessName;
    addMemory(project, {
      projectId: project.id,
      kind: "business_spec",
      key: "plan_spec",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("PlannerAgent", "PLAN", out.id, true);
  }

  private async runProductSpec() {
    this.begin("ProductAgent", "PRODUCT_SPEC");
    const project = this.project;
    const planSpec = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec;
    const businessPlan = planToBusinessPlan(planSpec);
    const result = await runProductAgent(project.brief, businessPlan);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "ProductAgent",
      schemaName: "ProductSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "product_spec",
      key: "product",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("ProductAgent", "PRODUCT_SPEC", out.id, true);
  }

  private async runDatabaseSpec() {
    this.begin("DatabaseAgent", "DATABASE_SPEC");
    const project = this.project;
    const product = getOutputByAgent(project, "ProductAgent")
      ?.data as unknown as ProductSpec;
    const result = await runDatabaseAgent(product);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DatabaseAgent",
      schemaName: "DatabaseSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "requires_human_action",
    });
    this.finish("DatabaseAgent", "DATABASE_SPEC", out.id, true);
  }

  private async runTechArchitecture() {
    this.begin("ArchitectureAgent", "TECH");
    const project = this.project;
    const product = getOutputByAgent(project, "ProductAgent")
      ?.data as unknown as ProductSpec;
    const result = await runArchitectureAgent(project.brief, product);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "ArchitectureAgent",
      schemaName: "ArchitectureSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "architecture",
      key: "architecture",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("ArchitectureAgent", "TECH", out.id, true);
  }

  private async runGenerate() {
    this.begin("DeveloperAgent", "GENERATE");
    const project = this.project;
    updateTask(project, "GENERATE", {
      progress: 30,
      activity: "DeveloperAgent preparing scaffold…",
    });
    saveFactoryProject(project);
    // Generation completes in BUILD step — mark generate as planning complete
    this.finish("DeveloperAgent", "GENERATE", null, true);
  }

  private async runBuild() {
    this.begin("DeveloperAgent", "BUILD");
    const project = this.project;
    const plan = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec;
    const product = getOutputByAgent(project, "ProductAgent")
      ?.data as unknown as ProductSpec;
    const architecture = getOutputByAgent(project, "ArchitectureAgent")
      ?.data as unknown as ArchitectureSpec;
    const database = getOutputByAgent(project, "DatabaseAgent")
      ?.data as unknown as DatabaseSpec;

    const provider = createSandboxProvider(project.id);
    const result = await runDeveloperAgentV3({
      plan,
      product,
      architecture,
      database,
    });

    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      schemaName: "CodeArtifactSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: [
        ...result.assumptions,
        provider.label,
        "[VERIFIED] AI GENERATED STARTER — not production-ready SaaS",
      ],
      source: result.source,
      implementationStatus: "automatically_implemented",
    });

    project.sandbox.buildLogs.push(
      provider.label,
      `Generated ${result.data.files.length} sandbox file(s)`,
      `Completeness: starter_mvp_scaffold`
    );
    addChange(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      reason: "Generate V3 mini-SaaS sandbox artifacts",
      filesChanged: result.data.files.map((f) => f.path),
      approvalStatus: "N/A",
      result: "sandbox MVP scaffold created",
      rollbackOf: null,
    });
    this.finish("DeveloperAgent", "BUILD", out.id, true);
  }

  private async regenerateBuild(): Promise<void> {
    appendActivity(
      this.project,
      "DeveloperAgent",
      "Repair attempt — regenerating scaffold",
      "warning"
    );
    await this.runBuild();
  }

  private async runTests(): Promise<{
    testsOk: boolean;
    requiresHumanReview: boolean;
  }> {
    this.begin("TestingAgent", "TEST");
    let project = this.project;
    let code = getOutputByAgent(project, "DeveloperAgent")
      ?.data as unknown as CodeArtifact;
    let attempt = 0;
    let result = await runTestingAgentV3(code);

    while (!result.data.passed && attempt < 2) {
      attempt += 1;
      appendActivity(
        project,
        "TestingAgent",
        `Tests failed — AI repair ${attempt}/3`,
        "warning"
      );
      await this.regenerateBuild();
      project = this.project;
      code = getOutputByAgent(project, "DeveloperAgent")
        ?.data as unknown as CodeArtifact;
      result = await runTestingAgentV3(code);
      result.data.attempts = attempt + 1;
    }

    const out = addOutput(project, {
      projectId: project.id,
      agent: "TestingAgent",
      schemaName: "TestReportSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });

    const testsOk = result.data.passed;
    const requiresHumanReview = !testsOk && result.data.requiresHumanApproval;

    this.finish(
      "TestingAgent",
      "TEST",
      out.id,
      testsOk,
      testsOk ? undefined : "Tests failed after max repair attempts"
    );

    if (requiresHumanReview) {
      updateTask(project, "TEST", {
        status: "REQUIRES_APPROVAL",
        activity: "REQUIRES_HUMAN_REVIEW",
      });
    }

    return { testsOk, requiresHumanReview };
  }

  private async runSecurityScan(): Promise<{
    securityOk: boolean;
    requiresSecurityApproval: boolean;
  }> {
    this.begin("SecurityAgent", "SECURITY_SCAN");
    const project = this.project;
    const code = getOutputByAgent(project, "DeveloperAgent")
      ?.data as unknown as CodeArtifact;
    const result = runSecurityScanAgent(code);

    const out = addOutput(project, {
      projectId: project.id,
      agent: "SecurityAgent",
      schemaName: "SecurityScanSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: result.data.passed
        ? "ai_generated"
        : "requires_human_action",
    });

    addMemory(project, {
      projectId: project.id,
      kind: "security_review",
      key: "security_scan",
      value: result.data as unknown as Record<string, unknown>,
    });

    const securityOk = result.data.passed;
    const requiresSecurityApproval = result.data.requiresApproval;

    this.finish(
      "SecurityAgent",
      "SECURITY_SCAN",
      out.id,
      securityOk,
      securityOk ? undefined : "Security scan findings require review"
    );

    if (requiresSecurityApproval) {
      updateTask(project, "SECURITY_SCAN", {
        status: "REQUIRES_APPROVAL",
        activity: "Security findings — approval required",
      });
    }

    return { securityOk, requiresSecurityApproval };
  }

  private async runDeployment(testsPassed: boolean) {
    this.begin("DeploymentAgent", "PREVIEW");
    const project = this.project;
    const result = await runDeploymentAgent(project.id, testsPassed);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeploymentAgent",
      schemaName: "DeploymentSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: [
        ...result.assumptions,
        "AI GENERATED STARTER — preview only, not auto-deployed",
      ],
      source: result.source,
      implementationStatus: testsPassed
        ? "requires_human_action"
        : "ai_generated",
    });
    this.finish(
      "DeploymentAgent",
      "PREVIEW",
      out.id,
      testsPassed,
      testsPassed ? undefined : "Preview blocked by failed tests/security"
    );
  }

  private async buildPassport() {
    this.begin("PassportAgent", "PASSPORT");
    const project = this.project;
    const passport = buildBusinessPassport(project);
    project.passport = passport;
    const out = addOutput(project, {
      projectId: project.id,
      agent: "PassportAgent",
      schemaName: "BusinessPassport",
      data: passport as unknown as Record<string, unknown>,
      labeledAssumptions: [passport.persistenceNote],
      source: "heuristic",
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "business_passport",
      key: "passport",
      value: passport as unknown as Record<string, unknown>,
    });
    this.finish("PassportAgent", "PASSPORT", out.id, true);
  }

  private async computeScore() {
    this.begin("ScoreAgent", "AI_SCORE");
    const project = this.project;
    const quality = computeFactoryQuality(project);
    setQuality(project, quality);
    project.passport = buildBusinessPassport(project);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "ScoreAgent",
      schemaName: "FactoryQualityScore",
      data: quality as unknown as Record<string, unknown>,
      labeledAssumptions: quality.explanations,
      source: "heuristic",
      implementationStatus: "ai_generated",
    });
    this.finish("ScoreAgent", "AI_SCORE", out.id, true);
  }

  private async runGrowth() {
    const project = this.project;
    const planSpec = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec;
    if (!planSpec) return;
    appendActivity(project, "GrowthAgent", "Running BUILD → GROW", "info");
    const businessPlan = planToBusinessPlan(planSpec);
    const result = await runGrowthAgent(businessPlan);
    addOutput(project, {
      projectId: project.id,
      agent: "GrowthAgent",
      schemaName: "GrowthPlanSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: [
        ...result.assumptions,
        "BUILD → GROW recommendations — no automatic production changes",
      ],
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.growthPlan = [
      "SEO plan:",
      ...result.data.seoSuggestions.map((s) => `  • ${s}`),
      "Growth opportunities:",
      ...(planSpec.coreWorkflows.length
        ? planSpec.coreWorkflows.map((s) => `  • ${s}`)
        : []),
      "Conversion:",
      ...result.data.conversionSuggestions.map((s) => `  • ${s}`),
      "Pricing ideas:",
      ...planSpec.pricing.tiers.map(
        (t) => `  • ${t.name} €${t.priceMonthlyEur}/mo — AI ESTIMATE`
      ),
      "Customer acquisition:",
      ...result.data.productImprovements.map((s) => `  • ${s}`),
    ];
    addMemory(project, {
      projectId: project.id,
      kind: "growth_plan",
      key: "v3_growth",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.trackCost("GrowthAgent");
    appendActivity(project, "GrowthAgent", "BUILD → GROW plan ready", "success");
    saveFactoryProject(project);
  }

  private async runFinance() {
    const project = this.project;
    const planSpec = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec;
    if (!planSpec) return;
    appendActivity(project, "FinanceAgent", "Running cost estimates", "info");
    const businessPlan = planToBusinessPlan(planSpec);
    const result = await runFinanceAgent(businessPlan, project.usage.aiCostEurEstimated);
    addOutput(project, {
      projectId: project.id,
      agent: "FinanceAgent",
      schemaName: "FinanceEstimateSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.usage.infrastructureMonthlyEur = result.data.estimatedInfraMonthlyEur;
    project.usage.thirdPartyMonthlyEur = result.data.estimatedThirdPartyMonthlyEur;
    this.trackCost("FinanceAgent");
    appendActivity(project, "FinanceAgent", "ESTIMATED BUILD COST updated", "success");
    saveFactoryProject(project);
  }

  private addStandardApprovals(project: FactoryProject) {
    addApproval(project, {
      projectId: project.id,
      action: "production_deploy",
      title: "Approve production deployment",
      explanation:
        "Deploying the generated starter MVP to production requires approval. Generated apps are NOT auto-deployed.",
      services: ["Sandbox preview host"],
      estimatedCostEur: project.usage.infrastructureMonthlyEur,
      risks: ["Public URL exposure", "Starter MVP — not production-hardened"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "payment_activation",
      title: "Activate payments (Mollie)",
      explanation:
        "Payment integration is NOT connected to generated apps automatically. Mollie is a payment processor, NOT escrow.",
      services: ["Mollie"],
      estimatedCostEur: 0,
      risks: ["Live charges", "Webhook misconfiguration"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "domain_connect",
      title: "Connect custom domain",
      explanation: "Domain connection requires DNS configuration and your approval.",
      services: ["DNS / domain registrar"],
      estimatedCostEur: null,
      risks: ["Domain cost", "Misconfigured DNS"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "database_change",
      title: "Connect production database",
      explanation:
        "Database spec exists but is NOT applied. Connecting Supabase or production Postgres requires approval.",
      services: ["Supabase / Postgres adapter"],
      estimatedCostEur: null,
      risks: ["Data migration", "RLS misconfiguration"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "marketplace_listing",
      title: "Prepare marketplace listing (BUILD → SELL)",
      explanation:
        "Creates a listing draft with AI ESTIMATE valuation. Never published automatically.",
      services: ["SITEFLIP marketplace"],
      estimatedCostEur: 0,
      risks: ["Premature listing without traction"],
    });
  }

  approveProduction(): FactoryProject {
    const project = this.project;
    const approval = project.approvals.find(
      (a) => a.action === "production_deploy" && a.status === "PENDING"
    );
    if (!approval) throw new Error("No pending production approval");
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    project.state = "LIVE";
    project.currentStep = "READY";
    project.liveAt = new Date().toISOString();
    project.sandbox.deploymentStatus = "LIVE";
    project.sandbox.productionUrl = `/build/${project.id}/preview?env=production`;
    updateTask(project, "READY", {
      status: "COMPLETED",
      progress: 100,
      activity: "Approved — sandbox production flag (not separate deploy)",
      completedAt: new Date().toISOString(),
    });
    updateTask(project, "APPROVAL", {
      status: "COMPLETED",
      activity: "Production approved",
    });
    project.passport = buildBusinessPassport(project);
    appendActivity(
      project,
      "DeploymentAgent",
      "Production approved — generated app NOT auto-deployed separately",
      "success"
    );
    return saveFactoryProject(project);
  }
}

/** Dispatch factory pipeline by version */
export async function runFactoryPipeline(projectId: string): Promise<FactoryProject> {
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Factory project not found");
  let result: FactoryProject;
  if (project.pipelineVersion === "v3" || project.pipelineVersion === "v4") {
    result = await new BusinessFactoryOrchestratorV3(projectId).runPipeline();
  } else {
    const { BusinessFactoryOrchestrator } = await import("./orchestrator");
    result = await new BusinessFactoryOrchestrator(projectId).runPipeline();
  }
  // Persist when production schema is ready (honest DEMO when not)
  try {
    const { persistFactoryProject } = await import("./supabase-store");
    const persisted = await persistFactoryProject(result);
    if (persisted.ok && persisted.mode === "supabase") {
      result.persistenceMode = "SUPABASE";
      saveFactoryProject(result);
    }
  } catch {
    // persistence probe failure must not crash pipeline
  }
  return result;
}

export function getFactoryOrchestrator(project: FactoryProject) {
  if (project.pipelineVersion === "v3" || project.pipelineVersion === "v4") {
    return new BusinessFactoryOrchestratorV3(project.id);
  }
  return null;
}
