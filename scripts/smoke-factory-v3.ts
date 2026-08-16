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
  const project = createFactoryProject(
    {
      idea: "Create a booking SaaS for cleaning companies in the Netherlands.",
      budget: "€2000",
      targetRevenue: "€1000 MRR",
      country: "Netherlands",
      targetCustomer: "Cleaning companies",
      businessType: "SaaS",
      businessModel: "B2B SaaS",
      preferredTechnology: "Next.js, Supabase",
      workloadPreference: "Part-time",
    },
    "demo-user",
    "v3"
  );
  console.log("created", project.id, "version", project.pipelineVersion);
  const result = await runFactoryPipeline(project.id);
  console.log("state", result.state);
  console.log(
    "steps",
    result.tasks.map((t) => `${t.stepId}:${t.status}`).join(" | ")
  );
  const code = result.outputs.find((o) => o.agent === "DeveloperAgent")?.data as
    | { completeness?: string; files?: Array<{ path: string }> }
    | undefined;
  console.log("completeness", code?.completeness);
  console.log(
    "pages",
    code?.files
      ?.filter((f) => f.path.includes("page.tsx"))
      .map((f) => f.path)
      .join(", ")
  );
  const tests = result.outputs.find((o) => o.agent === "TestingAgent")?.data as
    | { passed?: boolean }
    | undefined;
  const security = result.outputs.find((o) => o.agent === "SecurityAgent")?.data as
    | { passed?: boolean }
    | undefined;
  console.log("tests", tests?.passed);
  console.log("security", security?.passed);
  console.log("passport", result.passport?.applicationVersion);
  console.log(
    "PASS_V3",
    result.state === "APPROVAL_REQUIRED" &&
      code?.completeness === "starter_mvp_scaffold" &&
      tests?.passed &&
      security?.passed
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
