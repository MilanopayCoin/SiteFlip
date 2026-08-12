import { createFactoryProject } from "../src/lib/factory/store";
import { BusinessFactoryOrchestrator } from "../src/lib/factory/orchestrator";
import fs from "fs";
import path from "path";

const envPath = path.join(__dirname, "..", ".dev.vars");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const project = createFactoryProject({
    idea: "I want an AI booking platform for cleaning companies in the Netherlands.",
    budget: "€2000",
    targetRevenue: "€1000 MRR",
    country: "Netherlands",
    targetCustomer: "Cleaning companies",
    businessType: "SaaS",
    businessModel: "B2B SaaS",
    preferredTechnology: "Next.js, Supabase",
    workloadPreference: "Part-time",
  });
  console.log("created", project.id, "persistence", project.persistenceMode);
  const orch = new BusinessFactoryOrchestrator(project.id);
  const result = await orch.runPipeline();
  console.log("state", result.state);
  console.log(
    "steps",
    result.tasks.map((t) => `${t.stepId}:${t.status}`).join(" | ")
  );
  console.log(
    "agents",
    [...new Set(result.outputs.map((o) => `${o.agent}:${o.source}`))].join(", ")
  );
  console.log("aiScore", result.quality?.overall);
  console.log(
    "passport",
    result.passport?.businessName,
    result.passport?.lifecycle
  );
  console.log(
    "approvals",
    result.approvals.map((a) => a.action).join(", ")
  );
  const landing = result.outputs.find((o) => o.agent === "DeveloperAgent");
  console.log("landing", (landing?.data as { completeness?: string })?.completeness);
  console.log(
    "security",
    Boolean(result.outputs.find((o) => o.agent === "SecurityAgent"))
  );
  console.log(
    "PASS_PIPELINE",
    ["APPROVAL_REQUIRED", "READY", "PREVIEW"].includes(result.state)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
