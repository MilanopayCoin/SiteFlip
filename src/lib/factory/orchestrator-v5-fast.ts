/**
 * V5 Fast Create — Cloudflare Free–safe short path.
 *
 * IDEA → GENERATE → BUILD → PREVIEW → APPROVAL
 *
 * Skips long TEST/SECURITY AI loops. Uses heuristic agents by default so
 * Worker CPU / subrequest limits (Error 1102) are not blown on create.
 * Full V5 pipeline remains available via createMode: "full".
 */

import type {
  FactoryAgentName,
  FactoryProject,
  FactoryProjectState,
  V5PipelineStepId,
} from "./types";
import {
  addApproval,
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
  previewPathFor,
  provisionProjectSandbox,
  startProjectSandbox,
  runSandboxPhase,
} from "./sandbox";
import { computeFactoryQuality } from "./quality";
import { buildBusinessPassport } from "./passport";
import { runProductAgent } from "./agents";
import { runPlannerAgent, planToBusinessPlan } from "./agents/planner";
import { runDeveloperAgentV3 } from "./agents/developer-v3";
import { runDeploymentAgent } from "./agents";
import type {
  ArchitectureSpec,
  DatabaseSpec,
  PlanSpec,
  ProductSpec,
} from "./schemas";
import { withAiRuntimeOverride } from "@/lib/ai/runtime";
import { attachGeneratedAppArtifact } from "./generated-app-runtime";

const STATE_FOR_STEP: Partial<Record<V5PipelineStepId, FactoryProjectState>> = {
  IDEA: "IDEA",
  GENERATE: "PLANNING",
  BUILD: "BUILDING",
  PREVIEW: "PREVIEW",
  APPROVAL: "APPROVAL_REQUIRED",
};

export class BusinessFactoryOrchestratorV5Fast {
  private pinned: FactoryProject;
  private prevAiProvider: string | undefined;

  constructor(private projectId: string) {
    const p = getFactoryProject(projectId);
    if (!p) throw new Error("Factory project not found");
    this.pinned = p;
  }

  get project(): FactoryProject {
    saveFactoryProject(this.pinned);
    return this.pinned;
  }

  private begin(agent: FactoryAgentName, stepId: V5PipelineStepId) {
    const project = this.project;
    project.state = STATE_FOR_STEP[stepId] ?? project.state;
    project.currentStep = stepId;
    updateTask(project, stepId, {
      status: "RUNNING",
      progress: 15,
      activity: `${agent} (Fast Create)…`,
      startedAt: new Date().toISOString(),
      error: null,
      attempt: (project.tasks.find((t) => t.stepId === stepId)?.attempt ?? 0) + 1,
    });
    appendActivity(project, agent, `${stepId} running (Fast Create)`, "info");
    saveFactoryProject(project);
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
      activity: ok ? `${stepId} completed (Fast Create)` : `${stepId} failed`,
      completedAt: new Date().toISOString(),
      outputId: outputId ?? null,
      error: error ?? null,
    });
    appendActivity(
      project,
      agent,
      ok ? `${stepId} completed (Fast Create)` : `Failed: ${error}`,
      ok ? "success" : "error"
    );
    saveFactoryProject(project);
  }

  private skip(stepId: V5PipelineStepId, reason: string) {
    updateTask(this.project, stepId, {
      status: "SKIPPED",
      progress: 100,
      activity: reason,
      completedAt: new Date().toISOString(),
    });
  }

  async runPipeline(): Promise<FactoryProject> {
    // Heuristic-first via runtime override (Workers-safe; do not rely on process.env)
    return withAiRuntimeOverride({ forceHeuristic: true }, () =>
      this.runPipelineInner()
    );
  }

  private async runPipelineInner(): Promise<FactoryProject> {
    let project = this.project;
    assertSandboxBoundary(project);

    this.prevAiProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "heuristic";

    project.usage.buildAttempts += 1;
    project.sandbox.createMode = "fast";
    appendActivity(
      project,
      "Orchestrator",
      "Fast Create started — IDEA → GENERATE → BUILD → PREVIEW (Cloudflare Free safe)",
      "info"
    );
    saveFactoryProject(project);

    try {
      await this.runIdea();
      await this.runGenerate();
      await this.runSandboxLite();
      await this.runBuild();
      this.skip("TEST", "Skipped on Fast Create — run full V5 for deep tests");
      this.skip(
        "SECURITY",
        "Skipped on Fast Create — static scan available in full V5"
      );
      await this.runPreview();
      await this.finalizeApprovals();

      for (const stepId of [
        "LIVE",
        "PRODUCTION_ISOLATION",
        "SEPARATE_RUNTIME",
        "CUSTOM_DOMAIN",
        "MOLLIE",
        "GROWTH",
      ] as V5PipelineStepId[]) {
        updateTask(project, stepId, {
          status: "WAITING",
          progress: 0,
          activity:
            stepId === "LIVE"
              ? "Waiting for APPROVAL → GENERATED APP LIVE"
              : "After GENERATED APP LIVE",
        });
      }

      project = this.project;
      project.state = "APPROVAL_REQUIRED";
      project.currentStep = "APPROVAL";
      appendActivity(
        project,
        "Orchestrator",
        "Fast Create ready — review preview, then approve GENERATED APP LIVE",
        "success"
      );
      return saveFactoryProject(project);
    } catch (error) {
      project = this.project;
      const msg = error instanceof Error ? error.message : "Fast Create failed";
      for (const task of project.tasks) {
        if (task.status === "RUNNING") {
          updateTask(project, task.stepId, {
            status: "FAILED",
            progress: 100,
            activity: msg,
            error: msg,
            completedAt: new Date().toISOString(),
          });
        }
      }
      project.state = "FAILED";
      appendActivity(project, "Orchestrator", msg, "error");
      return saveFactoryProject(project);
    } finally {
      if (this.prevAiProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = this.prevAiProvider;
      }
    }
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
        createMode: "fast",
      },
    });
    this.finish("BusinessAgent", "IDEA", null, true);
  }

  private async runGenerate() {
    this.begin("DeveloperAgent", "GENERATE");
    const project = this.project;

    const planResult = await runPlannerAgent(project.brief);
    addOutput(project, {
      projectId: project.id,
      agent: "PlannerAgent",
      schemaName: "PlanSpecSchema",
      data: planResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: [
        ...planResult.assumptions,
        "FAST CREATE — heuristic plan (not deep research)",
      ],
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

    const businessPlan = planToBusinessPlan(planResult.data);
    const productResult = await runProductAgent(project.brief, businessPlan);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "ProductAgent",
      schemaName: "ProductSpecSchema",
      data: productResult.data as unknown as Record<string, unknown>,
      labeledAssumptions: productResult.assumptions,
      source: productResult.source,
      implementationStatus: "ai_generated",
    });

    // Lightweight stubs so BUILD always has architecture/database shapes
    addOutput(project, {
      projectId: project.id,
      agent: "DatabaseAgent",
      schemaName: "DatabaseSpecSchema",
      data: {
        strategy: "demo_adapter",
        tables: ["users", "customers", "bookings"],
        migrationSql:
          "-- Fast Create stub schema (demo adapter — not production)\n-- tables: users, customers, bookings\n",
        notes: ["FAST CREATE stub — not a production schema"],
      },
      labeledAssumptions: ["FAST CREATE stub database spec"],
      source: "heuristic",
      implementationStatus: "requires_human_action",
    });
    addOutput(project, {
      projectId: project.id,
      agent: "ArchitectureAgent",
      schemaName: "ArchitectureSchema",
      data: {
        stack: ["Next.js", "Supabase", "Mollie"],
        techStack: ["Next.js", "Supabase", "Mollie"],
        hosting: "JIY.APP sandbox preview",
        notes: ["FAST CREATE stub architecture"],
      },
      labeledAssumptions: ["FAST CREATE stub architecture"],
      source: "heuristic",
      implementationStatus: "ai_generated",
    });

    this.finish("DeveloperAgent", "GENERATE", out.id, true);
  }

  private async runSandboxLite() {
    this.begin("DeploymentAgent", "SANDBOX");
    const project = this.project;
    await provisionProjectSandbox(project);
    await startProjectSandbox(project);
    await runSandboxPhase(
      project,
      "RUNNING",
      "Fast Create SANDBOX — DEVELOPMENT ISOLATION"
    );
    project.sandbox.isolationLabel = "SANDBOX: DEVELOPMENT ISOLATION";
    project.sandbox.isProductionGrade = false;
    this.finish("DeploymentAgent", "SANDBOX", null, true);
  }

  private async runBuild() {
    this.begin("DeveloperAgent", "BUILD");
    const project = this.project;
    await runSandboxPhase(project, "BUILDING", "Fast Create BUILD");

    const plan = getOutputByAgent(project, "PlannerAgent")
      ?.data as unknown as PlanSpec;
    const product = getOutputByAgent(project, "ProductAgent")
      ?.data as unknown as ProductSpec;
    const architecture = getOutputByAgent(project, "ArchitectureAgent")
      ?.data as unknown as ArchitectureSpec;
    const database = getOutputByAgent(project, "DatabaseAgent")
      ?.data as unknown as DatabaseSpec;

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
        "FAST CREATE scaffold — AI GENERATED STARTER",
      ],
      source: result.source,
      implementationStatus: "automatically_implemented",
    });
    project.sandbox.buildLogs.push(
      `Fast Create: ${result.data.files.length} file(s)`,
      "Cloudflare Free safe path — heuristic agents"
    );
    this.finish("DeveloperAgent", "BUILD", out.id, true);
  }

  private async runPreview() {
    this.begin("DeploymentAgent", "PREVIEW");
    const project = this.project;
    await runSandboxPhase(project, "PREVIEW", "Fast Create PREVIEW");
    const result = await runDeploymentAgent(project.id, true);
    const out = addOutput(project, {
      projectId: project.id,
      agent: "DeploymentAgent",
      schemaName: "DeploymentPlanSchema",
      data: {
        ...(result.data as unknown as Record<string, unknown>),
        previewUrl: previewPathFor(project.id),
        label: "FAST CREATE PREVIEW",
      },
      labeledAssumptions: [
        ...(result.assumptions || []),
        "Platform preview — not production isolation",
      ],
      source: result.source,
      implementationStatus: "ai_generated",
    });
    project.sandbox.previewUrl = previewPathFor(project.id);
    project.sandbox.deploymentStatus = "READY";
    attachGeneratedAppArtifact(project);
    this.finish("DeploymentAgent", "PREVIEW", out.id, true);
  }

  private async finalizeApprovals() {
    const project = this.project;
    const quality = computeFactoryQuality(project);
    setQuality(project, quality);
    project.passport = {
      ...buildBusinessPassport(project),
      pipelineVersion: "v5",
      applicationVersion: "v5-fast-create",
      previewUrl: project.sandbox.previewUrl,
    };

    updateTask(project, "APPROVAL", {
      status: "REQUIRES_APPROVAL",
      progress: 100,
      activity: "Awaiting APPROVAL → GENERATED APP LIVE",
      completedAt: new Date().toISOString(),
    });

    if (!project.approvals.some((a) => a.action === "generated_app_live")) {
      addApproval(project, {
        projectId: project.id,
        action: "generated_app_live",
        title: "GENERATED APP LIVE",
        explanation:
          "Fast Create preview is ready. Approve to mark GENERATED APP LIVE under SANDBOX: DEVELOPMENT ISOLATION (not REAL PRODUCTION ISOLATION).",
        services: ["JIY.APP platform preview"],
        estimatedCostEur: 0,
        risks: [
          "Fast Create uses heuristic agents",
          "Not production-grade isolation",
          "Starter MVP only",
        ],
      });
    }
    saveFactoryProject(project);
  }
}

export function isFastCreateProject(project: FactoryProject): boolean {
  return project.sandbox?.createMode === "fast";
}
