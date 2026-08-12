/**
 * Regression: BUILD must survive missing PlannerAgent outputs (memory wipe race).
 */
import { createFactoryProject, getOutputByAgent, saveFactoryProject } from "../src/lib/factory/store";
import { BusinessFactoryOrchestratorV5 } from "../src/lib/factory/orchestrator-v5";
import type { CodeArtifact } from "../src/lib/factory/schemas";

async function main() {
  const project = createFactoryProject(
    {
      idea: "AI booking platform for cleaning companies in the Netherlands.",
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

  const orch = new BusinessFactoryOrchestratorV5(project.id);
  // Run GENERATE only via private path: simulate completed GENERATE then wipe outputs
  await (orch as unknown as { runIdea: () => Promise<void> }).runIdea();
  await (orch as unknown as { runGenerate: () => Promise<void> }).runGenerate();

  const before = getOutputByAgent(orch.project, "PlannerAgent");
  if (!before) throw new Error("GENERATE did not produce PlannerAgent output");

  // Simulate concurrent loadFactoryProject wipe
  const wiped = {
    ...orch.project,
    outputs: [],
    name: "Untitled Factory Project",
    memory: [],
  };
  saveFactoryProject(wiped as typeof project);

  // Re-pin orchestrator by constructing fresh instance on wiped map entry
  const orch2 = new BusinessFactoryOrchestratorV5(project.id);
  await (orch2 as unknown as { runSandbox: () => Promise<void> }).runSandbox();
  await (orch2 as unknown as { runBuild: () => Promise<void> }).runBuild();

  const code = getOutputByAgent(orch2.project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  if (!code?.files?.length) {
    throw new Error("BUILD recovery failed — no DeveloperAgent files");
  }
  if (orch2.project.name === "Untitled Factory Project") {
    throw new Error("BUILD recovery did not restore business name");
  }
  console.log(
    "V5_BUILD_RECOVERY_OK",
    orch2.project.name,
    "files",
    code.files.length,
    "outputs",
    orch2.project.outputs.length
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
