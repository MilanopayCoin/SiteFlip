import { factoryBriefSchema } from "../src/lib/factory/schemas";
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
  const parsed = factoryBriefSchema.parse({
    idea: "I want an AI booking platform for cleaning companies in the Netherlands.",
  });
  console.log("brief_defaults", {
    budget: parsed.budget,
    country: parsed.country,
    businessType: parsed.businessType,
  });
  const project = createFactoryProject(parsed);
  const result = await new BusinessFactoryOrchestrator(project.id).runPipeline();
  console.log("state", result.state);
  console.log("score", result.quality?.overall);
  console.log("passport", result.passport?.businessName, result.passport?.lifecycle);
  console.log(
    "PASS_IDEA_ONLY",
    ["APPROVAL_REQUIRED", "READY", "PREVIEW"].includes(result.state)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
