/**
 * V4.3 smoke — Real Sandbox architecture (honest DEVELOPMENT ISOLATION).
 * Does NOT claim production persistence or production-grade isolation.
 */
import { createFactoryProject, getOutputByAgent } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import {
  canDeployProduction,
  deployPreview,
  deployProduction,
  getRuntimeIsolationProvider,
  createBusinessRuntimeConfig,
  assertNoSecretsInConfig,
  getSandboxProvider,
} from "../src/lib/factory/deployment";
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
  console.log("V4.3 Sandbox architecture smoke");

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

  console.log("business_created", project.id);

  const result = await runFactoryPipeline(project.id);
  const code = getOutputByAgent(result, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  const tests = getOutputByAgent(result, "TestingAgent")?.data as
    | { passed?: boolean; attempts?: number }
    | undefined;
  const security = getOutputByAgent(result, "SecurityAgent")?.data as
    | { passed?: boolean }
    | undefined;

  const sandboxId = result.sandbox.sandboxId;
  const runtimeId = result.sandbox.runtimeId;
  const businessId = result.sandbox.businessId || result.id;
  console.log("sandbox_created", Boolean(sandboxId), sandboxId?.slice(0, 8));
  console.log("runtime_id", Boolean(runtimeId));
  console.log("business_id", businessId?.slice(0, 8));
  console.log("sandbox_lifecycle", result.sandbox.lifecycle);
  console.log("isolation_label", result.sandbox.isolationLabel);
  console.log("is_production_grade", result.sandbox.isProductionGrade === true);
  console.log("pipeline", result.state, result.pipelineVersion);
  console.log("generated_app", Boolean(code?.files?.length), code?.completeness);
  console.log("tests", tests?.passed, "attempts", tests?.attempts);
  console.log("security", security?.passed);

  const provider = getSandboxProvider();
  const status = sandboxId ? await provider.getStatus(sandboxId) : null;
  console.log("sandbox_status_lifecycle", status?.lifecycle);
  console.log("sandbox_running", status?.running);
  console.log(
    "resource_limits_enforced",
    status?.enforcedLimitCount,
    "/",
    (status?.enforcedLimitCount || 0) + (status?.unenforcedLimitCount || 0)
  );

  const isolationProvider = getRuntimeIsolationProvider();
  const isolationInput = {
    projectId: result.id,
    code: code ?? null,
    sandboxId,
    runtimeId,
    businessId,
  };
  const isolation = isolationProvider.validateIsolation(isolationInput);
  console.log("isolation_block", isolation.blockProduction);
  console.log("isolation_production_safe", isolationProvider.isProductionSafe(isolationInput));
  console.log(
    "checks",
    isolation.checks.map((c) => `${c.name}:${c.status}`).join(",")
  );

  const preview = await deployPreview(result.id);
  console.log(
    "preview_deploy",
    preview.deployment.status,
    preview.deployment.previewUrl
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
    version: "v4.3-test",
    publicUrl: `/build/${result.id}/preview`,
  });
  let secretOk = true;
  try {
    assertNoSecretsInConfig(config as unknown as Record<string, unknown>);
  } catch {
    secretOk = false;
  }
  console.log("secret_isolation", secretOk);

  // Honesty checks — must NOT claim production isolation/persistence
  const honestNoProductionGrade = result.sandbox.isProductionGrade !== true;
  const honestStopped =
    result.sandbox.lifecycle === "STOPPED" || status?.lifecycle === "STOPPED";
  const honestBlocked =
    prod.blocked === true &&
    isolation.blockProduction === true &&
    isolationProvider.isProductionSafe(isolationInput) === false;

  const pass =
    Boolean(sandboxId && runtimeId && businessId) &&
    Boolean(code?.files?.length) &&
    code?.completeness === "starter_mvp_scaffold" &&
    tests?.passed === true &&
    security?.passed === true &&
    preview.deployment.status === "LIVE" &&
    honestNoProductionGrade &&
    honestStopped &&
    honestBlocked &&
    secretOk &&
    provider.isProductionGrade === false;

  console.log("PASS_V4_3", pass);
  if (!pass) {
    console.log("FAIL_DETAIL", {
      sandboxId: Boolean(sandboxId),
      runtimeId: Boolean(runtimeId),
      code: Boolean(code?.files?.length),
      tests: tests?.passed,
      security: security?.passed,
      preview: preview.deployment.status,
      honestNoProductionGrade,
      honestStopped,
      honestBlocked,
      secretOk,
    });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
