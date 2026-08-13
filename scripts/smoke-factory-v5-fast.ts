/**
 * V5 Fast Create smoke — Free-safe short path.
 */
import { createFactoryProject } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
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
  process.env.AI_PROVIDER = "heuristic";
  process.env.JIY_PREVIEW_VERIFY = "inprocess";
  const project = createFactoryProject(
    {
      idea: "AI booking for cleaning companies in the Netherlands.",
      budget: "€2000",
      targetRevenue: "€1000 MRR",
      country: "Netherlands",
      targetCustomer: "Cleaning companies",
      businessType: "SaaS",
      businessModel: "B2B SaaS",
    },
    "demo-user",
    "v5"
  );

  const t0 = Date.now();
  const result = await runFactoryPipeline(project.id, { fastCreate: true });
  const tasks = result.tasks
    .filter((t) =>
      ["IDEA", "GENERATE", "SANDBOX", "BUILD", "TEST", "SECURITY", "PREVIEW", "APPROVAL"].includes(
        t.stepId
      )
    )
    .map((t) => `${t.stepId}:${t.status}`)
    .join(" | ");

  console.log(
    JSON.stringify(
      {
        id: result.id,
        state: result.state,
        createMode: result.sandbox?.createMode,
        currentStep: result.currentStep,
        outputs: result.outputs?.length,
        preview: result.sandbox?.previewUrl,
        ms: Date.now() - t0,
        tasks,
      },
      null,
      2
    )
  );

  if (result.state !== "APPROVAL_REQUIRED") {
    throw new Error(`Expected APPROVAL_REQUIRED, got ${result.state}`);
  }
  if (result.sandbox?.createMode !== "fast") {
    throw new Error("Expected createMode=fast");
  }
  if (!result.outputs?.length) {
    throw new Error("Expected outputs");
  }
  console.log("FAST CREATE SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
