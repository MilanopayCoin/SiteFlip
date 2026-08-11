/**
 * BusinessFactoryOrchestrator
 * Controls modular agents with typed Zod-validated outputs.
 * Does not fake progress — statuses update only when agents finish.
 */

import type {
  FactoryAgentName,
  FactoryProject,
  FactoryProjectState,
  PipelineStepId,
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
import { assertSandboxBoundary, previewPathFor } from "./sandbox";
import { computeFactoryQuality, estimateAgentCost } from "./quality";
import {
  runArchitectureAgent,
  runBrandAgent,
  runBusinessAgent,
  runContentAgent,
  runDatabaseAgent,
  runDeploymentAgent,
  runDeveloperAgent,
  runFinanceAgent,
  runGrowthAgent,
  runMarketAgent,
  runPaymentAgent,
  runProductAgent,
  runSeoAgent,
  runTestingAgent,
} from "./agents";
import type {
  BrandPlan,
  BusinessPlan,
  CodeArtifact,
  ContentPack,
  ProductSpec,
  SeoPack,
} from "./schemas";

const STATE_FOR_AGENT: Partial<Record<FactoryAgentName, FactoryProjectState>> = {
  BusinessAgent: "PLANNING",
  MarketAgent: "RESEARCHING",
  BrandAgent: "DESIGNING",
  ProductAgent: "DESIGNING",
  ArchitectureAgent: "DESIGNING",
  ContentAgent: "DESIGNING",
  SEOAgent: "BUILDING",
  DatabaseAgent: "BUILDING",
  PaymentAgent: "BUILDING",
  DeveloperAgent: "BUILDING",
  TestingAgent: "TESTING",
  DeploymentAgent: "PREVIEW",
  GrowthAgent: "PREVIEW",
  FinanceAgent: "PREVIEW",
};

export class BusinessFactoryOrchestrator {
  constructor(private projectId: string) {}

  get project(): FactoryProject {
    const p = getFactoryProject(this.projectId);
    if (!p) throw new Error("Factory project not found");
    return p;
  }

  /** Run the full MVP pipeline sequentially with real agent execution */
  async runPipeline(): Promise<FactoryProject> {
    let project = this.project;
    assertSandboxBoundary(project);

    if (project.state === "PAUSED") {
      appendActivity(project, "Orchestrator", "Pipeline is paused", "warning");
      return saveFactoryProject(project);
    }

    appendActivity(project, "Orchestrator", "Pipeline started", "info");
    project.state = "PLANNING";
    saveFactoryProject(project);

    // Cost estimate approval if over threshold
    const projectedAi =
      estimateAgentCost("BusinessAgent").costEur +
      estimateAgentCost("MarketAgent").costEur +
      estimateAgentCost("BrandAgent").costEur +
      estimateAgentCost("ProductAgent").costEur +
      estimateAgentCost("ArchitectureAgent").costEur +
      estimateAgentCost("ContentAgent").costEur +
      estimateAgentCost("SEOAgent").costEur +
      estimateAgentCost("DatabaseAgent").costEur +
      estimateAgentCost("PaymentAgent").costEur +
      estimateAgentCost("DeveloperAgent").costEur +
      estimateAgentCost("TestingAgent").costEur +
      estimateAgentCost("DeploymentAgent").costEur +
      estimateAgentCost("GrowthAgent").costEur +
      estimateAgentCost("FinanceAgent").costEur;

    if (projectedAi > project.usage.costThresholdEur) {
      const existing = project.approvals.find(
        (a) => a.action === "cost_threshold" && a.status === "PENDING"
      );
      if (!existing) {
        addApproval(project, {
          projectId: project.id,
          action: "cost_threshold",
          title: "Estimated AI cost exceeds threshold",
          explanation: `Estimated AI cost ≈ €${projectedAi.toFixed(2)} exceeds threshold €${project.usage.costThresholdEur}. Approve to continue the factory run.`,
          services: ["OpenAI (or heuristic fallback)"],
          estimatedCostEur: projectedAi,
          risks: ["Token spend", "Incomplete outputs if cancelled mid-run"],
        });
        project.state = "APPROVAL_REQUIRED";
        appendActivity(
          project,
          "Orchestrator",
          `Approval required — estimated AI cost €${projectedAi.toFixed(2)}`,
          "warning"
        );
        return saveFactoryProject(project);
      }
      if (existing.status !== "APPROVED") {
        project.state = "APPROVAL_REQUIRED";
        return saveFactoryProject(project);
      }
    }

    try {
      await this.runBusiness();
      await this.runMarket();
      // Mark BUSINESS step complete after market (business plan refined)
      this.completeStep("BUSINESS", "BusinessAgent");

      await this.runBrand();
      await this.runProduct();
      await this.runArchitecture();
      await this.runContent();
      await this.runSeo();
      await this.runDatabase();
      await this.runPayment();
      await this.runDeveloper();
      const testsOk = await this.runTesting();
      await this.runDeployment(testsOk);
      await this.runGrowth();
      await this.runFinance();

      project = this.project;
      setQuality(project, computeFactoryQuality(project));
      project.sandbox.previewUrl = previewPathFor(project.id);
      project.sandbox.deploymentStatus = testsOk ? "READY" : "FAILED";
      project.state = testsOk ? "PREVIEW" : "FAILED";
      project.currentStep = testsOk ? "DEPLOY" : "TEST";

      // Production deploy always needs approval
      if (testsOk) {
        addApproval(project, {
          projectId: project.id,
          action: "production_deploy",
          title: "Approve production deployment",
          explanation:
            "Preview is ready. Production deploy will publish the sandbox business. Domain connection and payment activation remain separate approvals.",
          services: ["Vercel-compatible host", "Sandbox preview"],
          estimatedCostEur: project.usage.infrastructureMonthlyEur,
          risks: [
            "Public URL exposure",
            "Hosting cost",
            "Incomplete MVP (landing-only)",
          ],
        });
        addApproval(project, {
          projectId: project.id,
          action: "payment_activation",
          title: "Activate Stripe payments",
          explanation:
            "Payment architecture exists but is not activated. Approving will allow connecting Stripe keys (never stored in AI memory).",
          services: ["Stripe"],
          estimatedCostEur: 0,
          risks: ["Live charges", "Webhook misconfiguration"],
        });
        project.state = "APPROVAL_REQUIRED";
        project.currentStep = "DEPLOY";
      }

      appendActivity(
        project,
        "Orchestrator",
        testsOk
          ? "Pipeline complete — preview ready, awaiting approvals"
          : "Pipeline finished with test failures",
        testsOk ? "success" : "error"
      );
      return saveFactoryProject(project);
    } catch (error) {
      project = this.project;
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

  private begin(agent: FactoryAgentName, stepId: PipelineStepId) {
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
    const cost = estimateAgentCost(agent);
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    project.usage.buildCostEur = project.usage.aiCostEurEstimated;
    saveFactoryProject(project);
  }

  private finish(
    agent: FactoryAgentName,
    stepId: PipelineStepId,
    outputId: string,
    ok: boolean,
    error?: string
  ) {
    const project = this.project;
    updateTask(project, stepId, {
      status: ok ? "COMPLETED" : "FAILED",
      progress: ok ? 100 : 100,
      activity: ok ? `${agent} completed` : `${agent} failed`,
      completedAt: new Date().toISOString(),
      outputId,
      error: error ?? null,
    });
    appendActivity(
      project,
      agent,
      ok ? "Completed" : `Failed: ${error}`,
      ok ? "success" : "error"
    );
    addChange(project, {
      projectId: project.id,
      agent,
      reason: `${agent} output`,
      filesChanged: [],
      approvalStatus: "N/A",
      result: ok ? "success" : error ?? "failed",
      rollbackOf: null,
    });
    saveFactoryProject(project);
  }

  private completeStep(stepId: PipelineStepId, agent: FactoryAgentName) {
    const project = this.project;
    updateTask(project, stepId, {
      status: "COMPLETED",
      progress: 100,
      activity: `${agent} completed`,
      completedAt: new Date().toISOString(),
    });
    saveFactoryProject(project);
  }

  private async runBusiness() {
    this.begin("BusinessAgent", "IDEA");
    // Also mark BUSINESS as running conceptually — IDEA produces the plan
    const project = this.project;
    updateTask(project, "BUSINESS", {
      status: "RUNNING",
      progress: 20,
      activity: "BusinessAgent drafting plan…",
      startedAt: new Date().toISOString(),
    });
    saveFactoryProject(project);

    const result = await runBusinessAgent(project.brief);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "BusinessAgent",
      schemaName: "BusinessPlanSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.name = result.data.businessName;
    addMemory(project, {
      projectId: project.id,
      kind: "business_spec",
      key: "business_plan",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("BusinessAgent", "IDEA", out.id, true);
  }

  private async runMarket() {
    this.begin("MarketAgent", "MARKET");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const result = await runMarketAgent(project.brief, plan);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "MarketAgent",
      schemaName: "MarketAnalysisSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "ai_decision",
      key: "market_analysis",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("MarketAgent", "MARKET", out.id, true);
  }

  private async runBrand() {
    this.begin("BrandAgent", "BRAND");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const result = await runBrandAgent(project.brief, plan);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "BrandAgent",
      schemaName: "BrandSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "brand_rules",
      key: "brand",
      value: result.data as unknown as Record<string, unknown>,
    });
    this.finish("BrandAgent", "BRAND", out.id, true);
  }

  private async runProduct() {
    this.begin("ProductAgent", "PRODUCT");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const result = await runProductAgent(project.brief, plan);
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
    this.finish("ProductAgent", "PRODUCT", out.id, true);
  }

  private async runArchitecture() {
    // Architecture shares PRODUCT step visually but logs separately
    const project = this.project;
    appendActivity(project, "ArchitectureAgent", "Running", "info");
    const product = getOutputByAgent(project, "ProductAgent")?.data as unknown as ProductSpec;
    const result = await runArchitectureAgent(project.brief, product);
    addOutput(project, {
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
    appendActivity(project, "ArchitectureAgent", "Completed", "success");
    const cost = estimateAgentCost("ArchitectureAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    saveFactoryProject(project);
  }

  private async runContent() {
    const project = this.project;
    appendActivity(project, "ContentAgent", "Running", "info");
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const brand = getOutputByAgent(project, "BrandAgent")?.data as unknown as BrandPlan;
    const product = getOutputByAgent(project, "ProductAgent")?.data as unknown as ProductSpec;
    const result = await runContentAgent(plan, brand, product);
    addOutput(project, {
      projectId: project.id,
      agent: "ContentAgent",
      schemaName: "ContentSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    appendActivity(project, "ContentAgent", "Completed", "success");
    const cost = estimateAgentCost("ContentAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    saveFactoryProject(project);
  }

  private async runSeo() {
    this.begin("SEOAgent", "SEO");
    const project = this.project;
    const brand = getOutputByAgent(project, "BrandAgent")?.data as unknown as BrandPlan;
    const content = getOutputByAgent(project, "ContentAgent")?.data as unknown as ContentPack;
    const result = await runSeoAgent(brand, content);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "SEOAgent",
      schemaName: "SEOSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    this.finish("SEOAgent", "SEO", out.id, true);
  }

  private async runDatabase() {
    this.begin("DatabaseAgent", "DATABASE");
    const project = this.project;
    const product = getOutputByAgent(project, "ProductAgent")?.data as unknown as ProductSpec;
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
    this.finish("DatabaseAgent", "DATABASE", out.id, true);
  }

  private async runPayment() {
    this.begin("PaymentAgent", "PAYMENTS");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const result = await runPaymentAgent(plan);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "PaymentAgent",
      schemaName: "PaymentSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "requires_external_integration",
    });
    this.finish("PaymentAgent", "PAYMENTS", out.id, true);
  }

  private async runDeveloper() {
    this.begin("DeveloperAgent", "CODE");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const brand = getOutputByAgent(project, "BrandAgent")?.data as unknown as BrandPlan;
    const content = getOutputByAgent(project, "ContentAgent")?.data as unknown as ContentPack;
    const seo = getOutputByAgent(project, "SEOAgent")?.data as unknown as SeoPack;
    const result = await runDeveloperAgent({ plan, brand, content, seo });
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      schemaName: "CodeArtifactSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "automatically_implemented",
    });
    project.sandbox.buildLogs.push(
      `Generated ${result.data.files.length} sandbox file(s)`,
      `Completeness: ${result.data.completeness}`
    );
    addChange(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      reason: "Generate sandbox landing artifacts",
      filesChanged: result.data.files.map((f) => f.path),
      approvalStatus: "N/A",
      result: "sandbox artifacts created",
      rollbackOf: null,
    });
    this.finish("DeveloperAgent", "CODE", out.id, true);
  }

  private async runTesting(): Promise<boolean> {
    this.begin("TestingAgent", "TEST");
    const project = this.project;
    const code = getOutputByAgent(project, "DeveloperAgent")?.data as unknown as CodeArtifact;
    let attempt = 0;
    let result = await runTestingAgent(code);
    while (!result.data.passed && attempt < 2) {
      attempt += 1;
      appendActivity(
        project,
        "TestingAgent",
        `Tests failed — retry ${attempt}/3 via DeveloperAgent`,
        "warning"
      );
      // Re-run developer once then retest
      await this.runDeveloper();
      const code2 = getOutputByAgent(this.project, "DeveloperAgent")
        ?.data as unknown as CodeArtifact;
      result = await runTestingAgent(code2);
      result.data.attempts = attempt + 1;
    }

    const out = addOutput(this.project, {
      projectId: this.project.id,
      agent: "TestingAgent",
      schemaName: "TestReportSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });

    if (!result.data.passed) {
      this.finish(
        "TestingAgent",
        "TEST",
        out.id,
        false,
        "Tests failed after max retries — human approval required"
      );
      updateTask(this.project, "TEST", { status: "REQUIRES_APPROVAL" });
      addApproval(this.project, {
        projectId: this.project.id,
        action: "change_request",
        title: "Testing failed — human approval required",
        explanation:
          "Automatic fix loop exhausted (max 3). Review test report and approve retry or edit specs.",
        services: ["TestingAgent", "DeveloperAgent"],
        estimatedCostEur: estimateAgentCost("DeveloperAgent").costEur,
        risks: ["Broken preview"],
      });
      saveFactoryProject(this.project);
      return false;
    }

    this.finish("TestingAgent", "TEST", out.id, true);
    return true;
  }

  private async runDeployment(testsPassed: boolean) {
    this.begin("DeploymentAgent", "DEPLOY");
    const project = this.project;
    const result = await runDeploymentAgent(project.id, testsPassed);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeploymentAgent",
      schemaName: "DeploymentSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: testsPassed
        ? "requires_human_action"
        : "ai_generated",
    });
    if (testsPassed) {
      updateTask(project, "DEPLOY", {
        status: "REQUIRES_APPROVAL",
        progress: 100,
        activity: "Preview ready — production requires approval",
        outputId: out.id,
        completedAt: new Date().toISOString(),
      });
      appendActivity(
        project,
        "DeploymentAgent",
        "Preview ready — awaiting production approval",
        "warning"
      );
    } else {
      this.finish("DeploymentAgent", "DEPLOY", out.id, false, "Blocked by failed tests");
    }
    saveFactoryProject(project);
  }

  private async runGrowth() {
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    if (!plan) return;
    appendActivity(project, "GrowthAgent", "Running", "info");
    const result = await runGrowthAgent(plan);
    addOutput(project, {
      projectId: project.id,
      agent: "GrowthAgent",
      schemaName: "GrowthPlanSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.growthPlan = result.data.weeks.map(
      (w) => `Week ${w.week}: ${w.title}`
    );
    addMemory(project, {
      projectId: project.id,
      kind: "growth_plan",
      key: "90_day",
      value: result.data as unknown as Record<string, unknown>,
    });
    appendActivity(project, "GrowthAgent", "Completed", "success");
    const cost = estimateAgentCost("GrowthAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    saveFactoryProject(project);
  }

  private async runFinance() {
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    if (!plan) return;
    appendActivity(project, "FinanceAgent", "Running", "info");
    const result = await runFinanceAgent(plan, project.usage.aiCostEurEstimated);
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
    appendActivity(project, "FinanceAgent", "Completed", "success");
    saveFactoryProject(project);
  }

  /** Mark production live after approval — does not expose credentials */
  approveProduction(): FactoryProject {
    const project = this.project;
    const approval = project.approvals.find(
      (a) => a.action === "production_deploy" && a.status === "PENDING"
    );
    if (!approval) throw new Error("No pending production approval");
    approval.status = "APPROVED";
    approval.resolvedAt = new Date().toISOString();
    project.state = "LIVE";
    project.currentStep = "LIVE";
    project.liveAt = new Date().toISOString();
    project.sandbox.deploymentStatus = "LIVE";
    project.sandbox.productionUrl = `/build/${project.id}/preview?env=production`;
    updateTask(project, "LIVE", {
      status: "COMPLETED",
      progress: 100,
      activity: "Business marked LIVE (sandbox production flag)",
      completedAt: new Date().toISOString(),
    });
    updateTask(project, "DEPLOY", {
      status: "COMPLETED",
      activity: "Production approved",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "user_approval",
      key: "production_deploy",
      value: { approvalId: approval.id, at: approval.resolvedAt },
    });
    addMemory(project, {
      projectId: project.id,
      kind: "deployment_history",
      key: "live",
      value: { url: project.sandbox.productionUrl },
    });
    appendActivity(
      project,
      "DeploymentAgent",
      "YOUR BUSINESS IS LIVE (sandbox production flag)",
      "success"
    );
    return saveFactoryProject(project);
  }
}
