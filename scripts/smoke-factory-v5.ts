/**
 * V5 factory smoke — IDEA → … → APPROVAL → DEPLOY → GENERATED APP LIVE
 * LIVE = platform preview under DEVELOPMENT ISOLATION (honest).
 */
import { createFactoryProject, getOutputByAgent } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import { goGeneratedAppLive } from "../src/lib/factory/orchestrator-v5";
import { getPipelineSteps } from "../src/lib/factory/types";
import type { CodeArtifact } from "../src/lib/factory/schemas";
import { BRAND } from "../src/lib/brand";
import fs from "fs";
import path from "path";

const envPath = path.join(__dirname, "..", ".dev.vars");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  console.log("BRAND", BRAND.fullName, BRAND.url);
  console.log("V5 pipeline smoke");

  const steps = getPipelineSteps("v5").map((s) => s.label);
  console.log("steps", steps.join(" → "));

  const project = createFactoryProject(
    {
      idea: "Create a booking SaaS for mobile bike repair shops in Amsterdam.",
      budget: "€1500",
      targetRevenue: "€800 MRR",
      country: "Netherlands",
      targetCustomer: "Mobile bike repair shops",
      businessType: "SaaS",
      businessModel: "B2B SaaS",
    },
    "demo-user",
    "v5"
  );

  const result = await runFactoryPipeline(project.id);
  console.log("state", result.state);
  console.log("currentStep", result.currentStep);
  console.log(
    "task_status",
    result.tasks.map((t) => `${t.stepId}:${t.status}`).join(" | ")
  );

  const code = getOutputByAgent(result, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  console.log("files", code?.files?.length ?? 0, code?.completeness);
  console.log("sandboxId", result.sandbox.sandboxId ? "set" : "missing");
  console.log("isolation", result.sandbox.isolationLabel);
  console.log("previewUrl", result.sandbox.previewUrl);

  const liveApproval = result.approvals.find(
    (a) => a.action === "generated_app_live" && a.status === "PENDING"
  );
  if (!liveApproval) {
    throw new Error("Missing generated_app_live approval");
  }
  liveApproval.status = "APPROVED";
  liveApproval.resolvedAt = new Date().toISOString();

  const live = await goGeneratedAppLive(result.id);
  console.log("live_state", live.state);
  console.log("live_step", live.currentStep);
  console.log("deploymentStatus", live.sandbox.deploymentStatus);
  console.log("productionUrl", live.sandbox.productionUrl);
  console.log(
    "live_task",
    live.tasks.find((t) => t.stepId === "LIVE")?.activity
  );

  if (live.state !== "LIVE") {
    throw new Error(`Expected LIVE, got ${live.state}`);
  }
  if (live.sandbox.productionUrl) {
    throw new Error("Must not set productionUrl without PRODUCTION ISOLATION");
  }
  if (live.sandbox.isolationLabel !== "SANDBOX: DEVELOPMENT ISOLATION") {
    throw new Error("Isolation label must stay DEVELOPMENT ISOLATION");
  }

  console.log("V5_SMOKE_OK");
}

main().catch((err) => {
  console.error("V5_SMOKE_FAIL", err);
  process.exit(1);
});
