/**
 * BusinessFactoryOrchestrator V5
 *
 * USER IDEA → AI PLAN → GENERATE → SANDBOX → BUILD → TEST → SECURITY →
 * PREVIEW → APPROVAL → DEPLOY → GENERATED APP LIVE
 *
 * LIVE = verified platform preview under SANDBOX: DEVELOPMENT ISOLATION.
 * Does NOT claim production-grade Worker isolation (Cloudflare Free).
 * Production into the main JIY.APP Worker remains blocked.
 */

import type {
  FactoryAgentName,
  FactoryProject,
  FactoryProjectState,
  V5PipelineStepId,
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
import {
  assertSandboxBoundary,
  createSandboxProvider,
  previewPathFor,
  provisionProjectSandbox,
  startProjectSandbox,
  stopProjectSandbox,
  runSandboxPhase,
} from "./sandbox";
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
import { deployPreview } from "./deployment";
import { unlockV5PostLiveRoadmap } from "./v5-post-live";
import type {
  ArchitectureSpec,
  CodeArtifact,
  DatabaseSpec,
  PlanSpec,
  ProductSpec,
} from "./schemas";

const STATE_FOR_STEP: Partial<Record<V5PipelineStepId, FactoryProjectState>> = {
  IDEA: "IDEA",
  GENERATE: "PLANNING",
  SANDBOX: "BUILDING",
  BUILD: "BUILDING",
  TEST: "TESTING",
  SECURITY: "TESTING",
  PREVIEW: "PREVIEW",
  APPROVAL: "APPROVAL_REQUIRED",
  LIVE: "LIVE",
  PRODUCTION_ISOLATION: "LIVE",
  SEPARATE_RUNTIME: "LIVE",
  CUSTOM_DOMAIN: "LIVE",
  MOLLIE: "LIVE",
  GROWTH: "LIVE",
};

const V5_AGENTS_COST: FactoryAgentName[] = [
  "PlannerAgent",
  "ProductAgent",
  "DatabaseAgent",
  "ArchitectureAgent",
  "DeveloperAgent",
  "TestingAgent",
  "SecurityAgent",
  "DeploymentAgent",
];

export class BusinessFactoryOrchestratorV5 {
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
    appendActivity(
      project,
      "Orchestrator",
      "Factory V5 pipeline started — IDEA → GENERATED APP LIVE",
      "info"
    );
    project.state = "IDEA";
    saveFactoryProject(project);

    const projectedAi = V5_AGENTS_COST.reduce(
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
          explanation: `Estimated AI cost ≈ €${projectedAi.toFixed(2)} exceeds threshold €${project.usage.costThresholdEur}. Approve to continue.`,
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
      await this.runIdea();
      await this.runGenerate(); // AI GENERATE = plan + specs + generate prep
      await this.runSandbox();
      await this.runBuild();
      const { testsOk, requiresHumanReview } = await this.runTests();
      const { securityOk, requiresSecurityApproval } =
        await this.runSecurityScan();

      const canPreview = testsOk && securityOk;
      if (canPreview) {
        await this.runPreview();
      } else {
        updateTask(project, "PREVIEW", {
          status: "FAILED",
          progress: 100,
          activity: "Preview blocked — tests or security failed",
          completedAt: new Date().toISOString(),
          error: "Cannot preview until TEST and SECURITY pass",
        });
      }

      // LIVE waits for generated_app_live approval; post-live roadmap stays WAITING
      updateTask(project, "LIVE", {
        status: "WAITING",
        progress: 0,
        activity: "Waiting for APPROVAL → GENERATED APP LIVE",
      });
      for (const stepId of [
        "PRODUCTION_ISOLATION",
        "SEPARATE_RUNTIME",
        "CUSTOM_DOMAIN",
        "MOLLIE",
        "GROWTH",
      ] as const) {
        updateTask(project, stepId, {
          status: "WAITING",
          progress: 0,
          activity: "After GENERATED APP LIVE",
        });
      }

      project = this.project;
      project.sandbox.previewUrl = previewPathFor(project.id);
      project.sandbox.deploymentStatus = canPreview ? "READY" : "FAILED";

      await stopProjectSandbox(project);
      appendActivity(
        project,
        "Orchestrator",
        "Sandbox STOPPED after PREVIEW — DEVELOPMENT ISOLATION (not production-grade)",
        "info"
      );

      await this.buildPassportAndScore();

      if (canPreview) {
        this.addStandardApprovals(project);
        updateTask(project, "APPROVAL", {
          status: "REQUIRES_APPROVAL",
          progress: 100,
          activity: "Awaiting APPROVAL → GENERATED APP LIVE",
          completedAt: new Date().toISOString(),
        });
        project.state = "APPROVAL_REQUIRED";
        project.currentStep = "APPROVAL";
        appendActivity(
          project,
          "Orchestrator",
          "V5 ready for APPROVAL → GENERATED APP LIVE (then production roadmap)",
          "success"
        );
      } else if (requiresHumanReview || requiresSecurityApproval) {
        project.state = "APPROVAL_REQUIRED";
        project.currentStep = requiresHumanReview ? "TEST" : "SECURITY";
        if (requiresHumanReview) {
          addApproval(project, {
            projectId: project.id,
            action: "change_request",
            title: "Testing failed — REQUIRES_HUMAN_REVIEW",
            explanation:
              "Automatic repair loop exhausted. Review test report before continuing.",
            services: ["TestingAgent", "DeveloperAgent"],
            estimatedCostEur: estimateAgentCost("DeveloperAgent").costEur,
            risks: ["Broken starter MVP"],
          });
        }
        if (requiresSecurityApproval) {
          addApproval(project, {
            projectId: project.id,
            action: "change_request",
            title: "Security scan requires approval",
            explanation:
              "Generated code failed security scan. Review findings before LIVE.",
            services: ["SecurityAgent"],
            estimatedCostEur: 0,
            risks: ["Unsafe patterns in generated code"],
          });
        }
      } else {
        project.state = "FAILED";
      }

      return saveFactoryProject(project);
    } catch (error) {
      project = this.project;
      this.failRunning(project, error);
      project.state = "FAILED";
      try {
        await runSandboxPhase(
          project,
          "FAILED",
          error instanceof Error ? error.message : "Pipeline failed"
        );
        await stopProjectSandbox(project);
      } catch {
        // ignore sandbox stop errors
      }
      appendActivity(
        project,
        "Orchestrator",
        error instanceof Error ? error.message : "Pipeline failed",
        "error"
      );
      return saveFactoryProject(project);
    }
  }

  private failRunning(project: FactoryProject, error: unknown) {
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

  private begin(agent: FactoryAgentName, stepId: V5PipelineStepId) {
    const project = this.project;
    project.state = STATE_FOR_STEP[stepId] ?? project.state;
    project.currentStep = stepId;
    updateTask(project, stepId, {
      status: "RUNNING",
      progress: 10,
      activity: `${agent} running…`,
      startedAt: new Date().toISOString(),
      error: null,
      attempt: (project.tasks.find((t) => t.stepId === stepId)?.attempt ?? 0) + 1,
    });
    appendActivity(project, agent, `${stepId} running`, "info");
    this.trackCost(agent);
  }

  private finish(
    agent: FactoryAgentName,
    stepId: V5PipelineStepId,
    outputId: string | null,
    ok: boolean,
    error?: string
  ) {
    const project = this.project;
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "FAILED",
      progress: 100,
      activity: ok ? `${stepId} completed` : `${stepId} failed`,
      completedAt: new Date().toISOString(),
      outputId: outputId ?? null,
      error: error ?? null,
    });
    appendActivity(
      project,
      agent,
      ok ? `${stepId} completed` : `Failed: ${error}`,
      ok ? "success" : "error"
    );
    saveFactoryProject(project);
  }

  private async runIdea() {
    this.begin("BusinessAgent", "IDEA");
    const project = this.project;
    const idea = project.brief.idea?.trim() || "";
    if (idea.length < 10) {
      this.finish(
        "BusinessAgent",
        "IDEA",
        null,
        false,
        "Idea must be at least 10 characters"
      );
      throw new Error("Invalid user idea");
    }
    addMemory(project, {
      projectId: project.id,
      kind: "business_spec",
      key: "user_idea",
      value: {
        idea,
        country: project.brief.country,
        businessType: project.brief.businessType,
        claimClass: "USER_PROVIDED",
      },
    });
    this.finish("BusinessAgent", "IDEA", null, true);
  }

  /** AI GENERATE — planner + product + database + architecture + generate prep */
  private async runGenerate() {
    this.begin("DeveloperAgent", "GENERATE");
    const project = this.project;

    updateTask(project, "GENERATE", {
      progress: 15,
      activity: "AI GENERATE — planning…",
    });
    saveFactoryProject(project);

    const planResult = await runPlannerAgent(project.brief);
    addOutput(project, {
      projectId: project.id,
      agent: "PlannerAgent",
      schemaName: "PlanSpecSchema",
      data: planResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: planResult.assumptions,
      source: planResult.source,
      implementationStatus: "ai_generated",
    });
    project.name = planResult.data.businessName;
    addMemory(project, {
      projectId: project.id,
      kind: "business_spec",
      key: "plan_spec",
      value: planResult.data as unknown as Record<string, unknown>,
    });
    this.trackCost("PlannerAgent");

    updateTask(project, "GENERATE", {
      progress: 40,
      activity: "AI GENERATE — product / database / architecture…",
    });
    saveFactoryProject(project);

    const businessPlan = planToBusinessPlan(planResult.data);
    const productResult = await runProductAgent(project.brief, businessPlan);
    addOutput(project, {
      projectId: project.id,
      agent: "ProductAgent",
      schemaName: "ProductSpecSchema",
      data: productResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: productResult.assumptions,
      source: productResult.source,
      implementationStatus: "ai_generated",
    });
    this.trackCost("ProductAgent");

    const dbResult = await runDatabaseAgent(productResult.data);
    addOutput(project, {
      projectId: project.id,
      agent: "DatabaseAgent",
      schemaName: "DatabaseSpecSchema",
      data: dbResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: dbResult.assumptions,
      source: dbResult.source,
      implementationStatus: "requires_human_action",
    });
    this.trackCost("DatabaseAgent");

    const archResult = await runArchitectureAgent(
      project.brief,
      productResult.data
    );
    const out = addOutput(project, {
      projectId: project.id,
      agent: "ArchitectureAgent",
      schemaName: "ArchitectureSchema",
      data: archResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: archResult.assumptions,
      source: archResult.source,
      implementationStatus: "ai_generated",
    });
    this.trackCost("ArchitectureAgent");

    updateTask(project, "GENERATE", {
      progress: 90,
      activity: "AI GENERATE complete — ready for SANDBOX → BUILD",
    });
    this.finish("DeveloperAgent", "GENERATE", out.id, true);
  }

  private async runSandbox() {
    this.begin("DeploymentAgent", "SANDBOX");
    const project = this.project;
    await provisionProjectSandbox(project);
    await startProjectSandbox(project);
    await runSandboxPhase(
      project,
      "RUNNING",
      "V5 SANDBOX — DEVELOPMENT ISOLATION (not production-grade)"
    );
    project.sandbox.isolationLabel =
      project.sandbox.isolationLabel || "SANDBOX: DEVELOPMENT ISOLATION";
    project.sandbox.buildLogs.push(
      `sandboxId=${project.sandbox.sandboxId || "n/a"}`,
      `runtimeId=${project.sandbox.runtimeId || "n/a"}`,
      project.sandbox.isolationLabel,
      "Cloudflare Free — no separate production Worker isolation"
    );
    this.finish("DeploymentAgent", "SANDBOX", null, true);
  }

  private async runBuild() {
    this.begin("DeveloperAgent", "BUILD");
    const project = this.project;
    assertSandboxBoundary(project);
    await runSandboxPhase(project, "BUILDING", "V5 BUILD phase");

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
        `sandboxId=${project.sandbox.sandboxId || "n/a"}`,
      ],
      source: result.source,
      implementationStatus: "automatically_implemented",
    });

    project.sandbox.buildLogs.push(
      `Generated ${result.data.files.length} sandbox file(s)`,
      "V5 BUILD — artifacts only (no host npm install on Worker Free)"
    );
    addChange(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      reason: "V5 BUILD scaffold",
      filesChanged: result.data.files.map((f) => f.path),
      approvalStatus: "N/A",
      result: "success",
      rollbackOf: null,
    });
    this.finish("DeveloperAgent", "BUILD", out.id, true);
  }

  private async runTests(): Promise<{
    testsOk: boolean;
    requiresHumanReview: boolean;
  }> {
    this.begin("TestingAgent", "TEST");
    const project = this.project;
    await runSandboxPhase(project, "TESTING", "V5 TEST phase");
    const code = getOutputByAgent(project, "DeveloperAgent")
      ?.data as unknown as CodeArtifact;
    const result = await runTestingAgentV3(code);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "TestingAgent",
      schemaName: "TestReportSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: result.data.passed
        ? "automatically_implemented"
        : "requires_human_action",
    });
    const ok = Boolean(result.data.passed);
    this.finish(
      "TestingAgent",
      "TEST",
      out.id,
      ok,
      ok ? undefined : "Tests failed"
    );
    return {
      testsOk: ok,
      requiresHumanReview: !ok && Boolean(result.data.requiresHumanApproval),
    };
  }

  private async runSecurityScan(): Promise<{
    securityOk: boolean;
    requiresSecurityApproval: boolean;
  }> {
    this.begin("SecurityAgent", "SECURITY");
    const project = this.project;
    await runSandboxPhase(project, "SECURITY_SCAN", "V5 SECURITY phase");
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
        ? "automatically_implemented"
        : "requires_human_action",
    });
    const ok = Boolean(result.data.passed);
    this.finish(
      "SecurityAgent",
      "SECURITY",
      out.id,
      ok,
      ok ? undefined : "Security findings"
    );
    return {
      securityOk: ok,
      requiresSecurityApproval: !ok,
    };
  }

  private async runPreview() {
    this.begin("DeploymentAgent", "PREVIEW");
    const project = this.project;
    await runSandboxPhase(project, "PREVIEW", "V5 PREVIEW — not production");
    const result = await runDeploymentAgent(project.id, true);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeploymentAgent",
      schemaName: "DeploymentPlanSchema",
      data: {
        ...(result.data as unknown as Record<string, unknown>),
        previewUrl: previewPathFor(project.id),
        label: "AI GENERATED STARTER PREVIEW",
      },
      labeledAssumptions: [
        ...(result.assumptions || []),
        "Preview is platform-hosted — not a separate production Worker",
      ],
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.sandbox.previewUrl = previewPathFor(project.id);
    this.finish("DeploymentAgent", "PREVIEW", out.id, true);
  }

  private async buildPassportAndScore() {
    const project = this.project;
    const quality = computeFactoryQuality(project);
    setQuality(project, quality);
    const passport = buildBusinessPassport(project);
    project.passport = {
      ...passport,
      pipelineVersion: "v5",
      applicationVersion: "v5-starter",
      previewUrl: project.sandbox.previewUrl,
    };

    // Optional growth/finance estimates (not visible V5 steps)
    const planSpec = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec | undefined;
    if (planSpec) {
      const businessPlan = planToBusinessPlan(planSpec);
      const growth = await runGrowthAgent(businessPlan);
      addOutput(project, {
        projectId: project.id,
        agent: "GrowthAgent",
        schemaName: "GrowthPlanSchema",
        data: growth.data as unknown as Record<string, unknown>,
        labeledAssumptions: growth.assumptions,
        source: growth.source,
        implementationStatus: "ai_generated",
      });
      const finance = await runFinanceAgent(
        businessPlan,
        project.usage.aiCostEurEstimated
      );
      addOutput(project, {
        projectId: project.id,
        agent: "FinanceAgent",
        schemaName: "FinanceEstimateSchema",
        data: finance.data as unknown as Record<string, unknown>,
        labeledAssumptions: finance.assumptions,
        source: finance.source,
        implementationStatus: "ai_generated",
      });
      project.usage.infrastructureMonthlyEur =
        finance.data.estimatedInfraMonthlyEur;
      project.usage.thirdPartyMonthlyEur =
        finance.data.estimatedThirdPartyMonthlyEur;
    }
    saveFactoryProject(project);
  }

  private addStandardApprovals(project: FactoryProject) {
    addApproval(project, {
      projectId: project.id,
      action: "generated_app_live",
      title: "GENERATED APP LIVE",
      explanation:
        "Approve to publish the verified platform preview as GENERATED APP LIVE. This is SANDBOX: DEVELOPMENT ISOLATION on Cloudflare Free — not REAL PRODUCTION ISOLATION. After LIVE, the roadmap continues: isolation → separate runtime → custom domain → Mollie → V5 growth.",
      services: ["JIY.APP platform preview", "Sandbox DEVELOPMENT ISOLATION"],
      estimatedCostEur: 0,
      risks: [
        "Not production-grade isolation",
        "Co-hosted on JIY.APP Worker preview path",
        "Starter MVP — not a hardened SaaS",
      ],
    });
    addApproval(project, {
      projectId: project.id,
      action: "production_deploy",
      title: "Production isolation deploy (blocked on Free)",
      explanation:
        "True production LIVE into a separate Worker identity remains blocked until PRODUCTION ISOLATION is provisioned. Approving this alone will not publish into the main JIY.APP Worker.",
      services: ["Requires separate Worker / isolation"],
      estimatedCostEur: project.usage.infrastructureMonthlyEur,
      risks: ["PRODUCTION ISOLATION REQUIRED"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "payment_activation",
      title: "Activate payments (Mollie)",
      explanation:
        "Mollie is a payment processor, NOT escrow. Not auto-wired into generated apps.",
      services: ["Mollie"],
      estimatedCostEur: 0,
      risks: ["Live charges", "Webhook misconfiguration"],
    });
    addApproval(project, {
      projectId: project.id,
      action: "marketplace_listing",
      title: "Publish marketplace listing",
      explanation: "List this generated business on JIY.APP marketplace.",
      services: ["JIY.APP marketplace"],
      estimatedCostEur: 0,
      risks: ["Public visibility"],
    });
  }
}

/**
 * After user approves `generated_app_live`:
 * verified platform preview → GENERATED APP LIVE, then unlock post-live roadmap.
 */
export async function goGeneratedAppLive(
  projectId: string
): Promise<FactoryProject> {
  const project = getFactoryProject(projectId);
  if (!project) throw new Error("Factory project not found");
  if (project.pipelineVersion !== "v5") {
    throw new Error("goGeneratedAppLive is V5-only");
  }

  project.state = "DEPLOYING";
  project.currentStep = "LIVE";
  updateTask(project, "LIVE", {
    status: "RUNNING",
    progress: 20,
    activity: "Publishing verified platform preview…",
    startedAt: new Date().toISOString(),
    error: null,
  });
  appendActivity(
    project,
    "DeploymentAgent",
    "V5 GENERATED APP LIVE publish started",
    "info"
  );
  saveFactoryProject(project);

  const result = await deployPreview(projectId);
  const refreshed = getFactoryProject(projectId)!;

  if (result.deployment.status !== "LIVE") {
    updateTask(refreshed, "LIVE", {
      status: "FAILED",
      progress: 100,
      activity: `Live publish failed: ${result.deployment.status}`,
      completedAt: new Date().toISOString(),
      error: result.deployment.error || result.deployment.status,
    });
    refreshed.state = "FAILED";
    appendActivity(
      refreshed,
      "DeploymentAgent",
      result.deployment.error || "Preview deploy failed",
      "error"
    );
    return saveFactoryProject(refreshed);
  }

  refreshed.state = "LIVE";
  refreshed.currentStep = "LIVE";
  refreshed.liveAt = new Date().toISOString();
  refreshed.sandbox.deploymentStatus = "LIVE";
  refreshed.sandbox.previewUrl =
    refreshed.sandbox.previewUrl || previewPathFor(refreshed.id);
  refreshed.sandbox.isolationLabel = "SANDBOX: DEVELOPMENT ISOLATION";
  refreshed.sandbox.productionUrl = null; // honest — not production isolation
  updateTask(refreshed, "LIVE", {
    status: "COMPLETED",
    progress: 100,
    activity:
      "GENERATED APP LIVE (platform preview — DEVELOPMENT ISOLATION). NEXT: REAL PRODUCTION ISOLATION",
    completedAt: new Date().toISOString(),
  });
  if (refreshed.passport) {
    refreshed.passport = {
      ...refreshed.passport,
      factoryStatus: "LIVE",
      lifecycle: "LIVE",
      previewUrl: refreshed.sandbox.previewUrl,
      productionUrl: null,
      deploymentStatus: "LIVE",
      runtimeStatus: "PLATFORM_PREVIEW_LIVE",
    };
  }
  unlockV5PostLiveRoadmap(refreshed);
  appendActivity(
    refreshed,
    "DeploymentAgent",
    "GENERATED APP LIVE — YOU ARE HERE. Next: REAL PRODUCTION ISOLATION (blocked on Cloudflare Free)",
    "success"
  );
  return saveFactoryProject(refreshed);
}
