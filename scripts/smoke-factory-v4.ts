import { createFactoryProject } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import {
  canDeployProduction,
  deployPreview,
  deployProduction,
  getRuntimeIsolationProvider,
  createBusinessRuntimeConfig,
  assertNoSecretsInConfig,
} from "../src/lib/factory/deployment";
import { getOutputByAgent } from "../src/lib/factory/store";
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
    "v4"
  );

  const result = await runFactoryPipeline(project.id);
  const code = getOutputByAgent(result, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const tests = getOutputByAgent(result, "TestingAgent")?.data as
    | { passed?: boolean }
    | undefined;
  const security = getOutputByAgent(result, "SecurityAgent")?.data as
    | { passed?: boolean }
    | undefined;

  console.log("pipeline", result.state, result.pipelineVersion);
  console.log("completeness", code?.completeness);
  console.log("tests", tests?.passed, "security", security?.passed);

  const isolation = getRuntimeIsolationProvider().checkIsolation({
    projectId: result.id,
    code: code ?? null,
  });
  console.log("isolation_block", isolation.blockProduction);
  console.log("isolation_msg", isolation.message.slice(0, 80));

  const preview = await deployPreview(result.id);
  console.log(
    "preview_deploy",
    preview.deployment.status,
    preview.deployment.healthCheckPassed
  );

  const gate = await canDeployProduction(result.id);
  console.log("production_gate", gate.ok, gate.blockers.join(" | "));

  const prod = await deployProduction(result.id);
  console.log(
    "production_deploy",
    prod.blocked,
    prod.deployment.status,
    prod.deployment.error
  );

  const config = createBusinessRuntimeConfig({
    appName: result.name,
    businessId: result.id,
    version: "v4-test",
    publicUrl: `/build/${result.id}/preview`,
  });
  let secretOk = true;
  try {
    assertNoSecretsInConfig(config as unknown as Record<string, unknown>);
  } catch {
    secretOk = false;
  }
  console.log("secret_isolation", secretOk);
  console.log("passport", result.passport?.deploymentStatus, result.passport?.lifecycle);

  const pass =
    result.state === "APPROVAL_REQUIRED" &&
    code?.completeness === "starter_mvp_scaffold" &&
    tests?.passed === true &&
    security?.passed === true &&
    preview.deployment.status === "LIVE" &&
    prod.blocked === true &&
    isolation.blockProduction === true &&
    secretOk;

  console.log("PASS_V4", pass);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
