/**
 * BusinessFactoryOrchestrator — AI Business Factory V1
 * Modular agents with typed Zod-validated outputs.
 * Statuses update only when agents finish. No automatic deploy/payments.
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
import { buildBusinessPassport } from "./passport";
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
  runSecurityAgent,
  runSeoAgent,
  runTestingAgent,
} from "./agents";
import type {
  ArchitectureSpec,
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
  SecurityAgent: "DESIGNING",
  ContentAgent: "BUILDING",
  SEOAgent: "BUILDING",
  DatabaseAgent: "BUILDING",
  PaymentAgent: "BUILDING",
  DeveloperAgent: "BUILDING",
  TestingAgent: "TESTING",
  DeploymentAgent: "PREVIEW",
  PassportAgent: "PREVIEW",
  ScoreAgent: "PREVIEW",
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

  async runPipeline(): Promise<FactoryProject> {
    let project = this.project;
    assertSandboxBoundary(project);

    if (project.state === "PAUSED") {
      appendActivity(project, "Orchestrator", "Pipeline is paused", "warning");
      return saveFactoryProject(project);
    }

    appendActivity(project, "Orchestrator", "Factory V1 pipeline started", "info");
    project.state = "PLANNING";
    saveFactoryProject(project);

    const projectedAi =
      estimateAgentCost("BusinessAgent").costEur +
      estimateAgentCost("MarketAgent").costEur +
      estimateAgentCost("BrandAgent").costEur +
      estimateAgentCost("ProductAgent").costEur +
      estimateAgentCost("ArchitectureAgent").costEur +
      estimateAgentCost("SecurityAgent").costEur +
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
          explanation: `Estimated AI cost ≈ €${projectedAi.toFixed(2)} exceeds threshold €${project.usage.costThresholdEur}. Approve to continue. Estimates only — not a verified invoice.`,
          services: ["Configured AI provider (Groq/OpenAI/…)"],
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
      this.completeStep("BLUEPRINT", "BusinessAgent");

      await this.runBrand();
      await this.runProduct();
      await this.runArchitecture();
      await this.runSecurity();
      await this.runContent();
      await this.runSeo();
      await this.runDatabase();
      await this.runPayment();
      await this.runDeveloper();
      const testsOk = await this.runTesting();
      await this.runDeployment(testsOk);
      await this.buildPassport();
      await this.computeScore();
      await this.runGrowth();
      await this.runFinance();

      project = this.project;
      project.sandbox.previewUrl = previewPathFor(project.id);
      project.sandbox.deploymentStatus = testsOk ? "READY" : "FAILED";

      if (testsOk) {
        addApproval(project, {
          projectId: project.id,
          action: "landing_page_finalize",
          title: "Approve final landing page",
          explanation:
            "Starter landing preview is ready. Approving finalizes the generated landing for this factory project. This does not deploy to production.",
          services: ["DeveloperAgent sandbox"],
          estimatedCostEur: 0,
          risks: ["Public-facing copy may need edits"],
        });
        addApproval(project, {
          projectId: project.id,
          action: "production_deploy",
          title: "Approve production deployment",
          explanation:
            "Production deploy will publish the sandbox business. Domain connection and payment activation remain separate approvals. Nothing auto-deploys.",
          services: ["Sandbox preview host"],
          estimatedCostEur: project.usage.infrastructureMonthlyEur,
          risks: ["Public URL exposure", "Hosting cost", "Landing-only MVP"],
        });
        addApproval(project, {
          projectId: project.id,
          action: "payment_activation",
          title: "Activate payments",
          explanation:
            "Payment architecture exists but is not activated. Approving allows connecting Mollie (never stored in AI memory). Mollie is a payment processor, not escrow.",
          services: ["Payment provider"],
          estimatedCostEur: 0,
          risks: ["Live charges", "Webhook misconfiguration"],
        });
        addApproval(project, {
          projectId: project.id,
          action: "domain_connect",
          title: "Connect custom domain",
          explanation:
            "Domain suggestions are not availability-checked. Connecting a domain requires your approval and DNS configuration.",
          services: ["DNS / domain registrar"],
          estimatedCostEur: null,
          risks: ["Domain cost", "Misconfigured DNS"],
        });
        addApproval(project, {
          projectId: project.id,
          action: "marketplace_listing",
          title: "Prepare SITEFLIP marketplace listing",
          explanation:
            "Creates a listing draft from the Business Passport. Publishing requires a separate approval. AI valuation is an estimate only.",
          services: ["SITEFLIP marketplace"],
          estimatedCostEur: 0,
          risks: ["Premature listing without traction"],
        });

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
          activity: "Preview ready",
          completedAt: new Date().toISOString(),
        });

        project.state = "APPROVAL_REQUIRED";
        project.currentStep = "APPROVAL";
      } else {
        project.state = "FAILED";
        project.currentStep = "LANDING";
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
      progress: 100,
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
    const project = this.project;
    updateTask(project, "BLUEPRINT", {
      status: "RUNNING",
      progress: 20,
      activity: "BusinessAgent drafting blueprint…",
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
    this.begin("MarketAgent", "ANALYSIS");
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
    this.finish("MarketAgent", "ANALYSIS", out.id, true);
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
    this.begin("ArchitectureAgent", "TECH");
    const project = this.project;
    const product = getOutputByAgent(project, "ProductAgent")?.data as unknown as ProductSpec;
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

  private async runSecurity() {
    const project = this.project;
    appendActivity(project, "SecurityAgent", "Running", "info");
    const arch = getOutputByAgent(project, "ArchitectureAgent")?.data as unknown as ArchitectureSpec;
    const result = await runSecurityAgent(arch);
    addOutput(project, {
      projectId: project.id,
      agent: "SecurityAgent",
      schemaName: "SecurityReviewSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    addMemory(project, {
      projectId: project.id,
      kind: "security_review",
      key: "security",
      value: result.data as unknown as Record<string, unknown>,
    });
    const cost = estimateAgentCost("SecurityAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    appendActivity(project, "SecurityAgent", "Completed", "success");
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
    const project = this.project;
    appendActivity(project, "SEOAgent", "Running", "info");
    const brand = getOutputByAgent(project, "BrandAgent")?.data as unknown as BrandPlan;
    const content = getOutputByAgent(project, "ContentAgent")?.data as unknown as ContentPack;
    const result = await runSeoAgent(brand, content);
    addOutput(project, {
      projectId: project.id,
      agent: "SEOAgent",
      schemaName: "SEOSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });
    const cost = estimateAgentCost("SEOAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    appendActivity(project, "SEOAgent", "Completed", "success");
    saveFactoryProject(project);
  }

  private async runDatabase() {
    const project = this.project;
    appendActivity(project, "DatabaseAgent", "Running", "info");
    const product = getOutputByAgent(project, "ProductAgent")?.data as unknown as ProductSpec;
    const result = await runDatabaseAgent(product);
    addOutput(project, {
      projectId: project.id,
      agent: "DatabaseAgent",
      schemaName: "DatabaseSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "requires_human_action",
    });
    const cost = estimateAgentCost("DatabaseAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    appendActivity(project, "DatabaseAgent", "Completed (not applied)", "success");
    saveFactoryProject(project);
  }

  private async runPayment() {
    const project = this.project;
    appendActivity(project, "PaymentAgent", "Running", "info");
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const result = await runPaymentAgent(plan);
    addOutput(project, {
      projectId: project.id,
      agent: "PaymentAgent",
      schemaName: "PaymentSpecSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "requires_external_integration",
    });
    const cost = estimateAgentCost("PaymentAgent");
    project.usage.aiTokensEstimated += cost.tokens;
    project.usage.aiCostEurEstimated =
      Math.round((project.usage.aiCostEurEstimated + cost.costEur) * 100) / 100;
    appendActivity(project, "PaymentAgent", "Completed (not activated)", "success");
    saveFactoryProject(project);
  }

  private async runDeveloper() {
    this.begin("DeveloperAgent", "LANDING");
    const project = this.project;
    const plan = getOutputByAgent(project, "BusinessAgent")?.data as unknown as BusinessPlan;
    const brand = getOutputByAgent(project, "BrandAgent")?.data as unknown as BrandPlan;
    const content = getOutputByAgent(project, "ContentAgent")?.data as unknown as ContentPack;
    const seo = getOutputByAgent(project, "SEOAgent")?.data as unknown as SeoPack;
    const result = await runDeveloperAgent({ plan, brand, content, seo });
    // Force landing-only claim
    result.data.completeness = "landing_page_only";
    result.data.sandboxOnly = true;
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      schemaName: "CodeArtifactSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: [
        ...result.assumptions,
        "[VERIFIED] Factory V1 generates a starter landing page only — not a complete SaaS",
      ],
      source: result.source,
      implementationStatus: "automatically_implemented",
    });
    project.sandbox.buildLogs.push(
      `Generated ${result.data.files.length} sandbox file(s)`,
      `Completeness: landing_page_only`
    );
    addChange(project, {
      projectId: project.id,
      agent: "DeveloperAgent",
      reason: "Generate sandbox landing artifacts",
      filesChanged: result.data.files.map((f) => f.path),
      approvalStatus: "N/A",
      result: "sandbox landing artifacts created",
      rollbackOf: null,
    });
    this.finish("DeveloperAgent", "LANDING", out.id, true);
  }

  private async runTesting(): Promise<boolean> {
    const project = this.project;
    appendActivity(project, "TestingAgent", "Running", "info");
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
      await this.runDeveloper();
      const code2 = getOutputByAgent(this.project, "DeveloperAgent")
        ?.data as unknown as CodeArtifact;
      result = await runTestingAgent(code2);
      result.data.attempts = attempt + 1;
    }

    addOutput(this.project, {
      projectId: this.project.id,
      agent: "TestingAgent",
      schemaName: "TestReportSchema",
      data: result.data as unknown as Record<string, unknown>,
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: "ai_generated",
    });

    if (!result.data.passed) {
      addApproval(this.project, {
        projectId: this.project.id,
        action: "change_request",
        title: "Testing failed — human approval required",
        explanation:
          "Automatic fix loop exhausted. Review test report and approve retry or edit specs.",
        services: ["TestingAgent", "DeveloperAgent"],
        estimatedCostEur: estimateAgentCost("DeveloperAgent").costEur,
        risks: ["Broken preview"],
      });
      saveFactoryProject(this.project);
      return false;
    }

    appendActivity(this.project, "TestingAgent", "Completed", "success");
    saveFactoryProject(this.project);
    return true;
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
      labeledAssumptions: result.assumptions,
      source: result.source,
      implementationStatus: testsPassed
        ? "requires_human_action"
        : "ai_generated",
    });
    if (testsPassed) {
      this.finish("DeploymentAgent", "PREVIEW", out.id, true);
    } else {
      this.finish("DeploymentAgent", "PREVIEW", out.id, false, "Blocked by failed tests");
    }
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
    // Refresh passport with score
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
    project.growthPlan = [
      ...result.data.weeks.map((w) => `Week ${w.week}: ${w.title}`),
      ...result.data.seoSuggestions.map((s) => `SEO: ${s}`),
      ...result.data.conversionSuggestions.map((s) => `Conversion: ${s}`),
      ...result.data.productImprovements.map((s) => `Product: ${s}`),
    ];
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
    appendActivity(project, "FinanceAgent", "Completed (estimates only)", "success");
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
    project.currentStep = "READY";
    project.liveAt = new Date().toISOString();
    project.sandbox.deploymentStatus = "LIVE";
    project.sandbox.productionUrl = `/build/${project.id}/preview?env=production`;
    updateTask(project, "READY", {
      status: "COMPLETED",
      progress: 100,
      activity: "Ready to launch — sandbox production flag",
      completedAt: new Date().toISOString(),
    });
    updateTask(project, "APPROVAL", {
      status: "COMPLETED",
      activity: "Production approved",
    });
    project.passport = buildBusinessPassport(project);
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
