/**
 * V4.4 Deployment Engine smoke.
 * Preview LIVE only after verification. Production remains blocked.
 */
import { createFactoryProject, getOutputByAgent } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import {
  canDeployProduction,
  deployPreview,
  deployProduction,
  getProjectDeployments,
  getDeploymentProvider,
  rollbackProject,
  listDomains,
  addDomain,
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
  console.log("V4.4 Deployment Engine smoke");

  const project = createFactoryProject(
    {
      idea: "Create a booking SaaS for cleaning companies in the Netherlands.",
      budget: "€2000",
      targetRevenue: "€1000 MRR",
      country: "Netherlands",
      targetCustomer: "Cleaning companies",
      businessType: "SaaS",
      businessModel: "B2B SaaS",
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

  console.log("pipeline", result.state);
  console.log("build_artifacts", code?.files?.length ?? 0);
  console.log("tests", tests?.passed, "security", security?.passed);

  const provider = getDeploymentProvider();
  const created = await provider.createProject({
    projectId: result.id,
    businessId: result.id,
    name: result.name,
  });
  console.log("createProject", created.projectRef);

  const build = await provider.buildProject({
    projectId: result.id,
    version: "v4.4-smoke",
  });
  console.log("buildProject", build.ok, build.logs.slice(-1)[0]);

  const preview = await deployPreview(result.id);
  console.log(
    "preview",
    preview.deployment.status,
    "health",
    preview.deployment.healthCheckPassed,
    preview.deployment.deploymentId
  );

  const history = getProjectDeployments(result.id);
  console.log("deployment_history", history.length, history[0]?.status);

  const gate = await canDeployProduction(result.id);
  console.log("production_gate", gate.ok, gate.blockers.join(" | "));

  const prod = await deployProduction(result.id);
  console.log(
    "production",
    prod.blocked,
    prod.deployment.status,
    prod.deployment.error
  );

  // Rollback requires approval — first call should request approval
  let rollbackNeedsApproval = false;
  try {
    await rollbackProject(result.id, preview.deployment.deploymentId);
  } catch (e) {
    rollbackNeedsApproval = String(e).includes("approval");
  }
  console.log("rollback_requires_approval", rollbackNeedsApproval);

  // Approve rollback then execute
  const { getFactoryProject, saveFactoryProject } = await import(
    "../src/lib/factory/store"
  );
  const p = getFactoryProject(result.id)!;
  const rollbackApproval = p.approvals.find(
    (a) => a.title.includes("Rollback") && a.status === "PENDING"
  );
  if (rollbackApproval) {
    rollbackApproval.status = "APPROVED";
    rollbackApproval.resolvedAt = new Date().toISOString();
    saveFactoryProject(p);
  }
  const rolled = await rollbackProject(
    result.id,
    preview.deployment.deploymentId,
    { approved: true }
  );
  console.log("rollback", rolled.status, rolled.healthCheckPassed);

  const domain = addDomain(result.id, "example-clean.jiy.app", result.slug);
  console.log("domain_add", domain.domain, domain.status);
  console.log("domains", listDomains(result.id).length);

  const pass =
    build.ok === true &&
    (code?.files?.length ?? 0) > 0 &&
    tests?.passed === true &&
    security?.passed === true &&
    preview.deployment.status === "LIVE" &&
    preview.deployment.healthCheckPassed === true &&
    history.length >= 1 &&
    gate.ok === false &&
    prod.blocked === true &&
    prod.deployment.error === "PRODUCTION ISOLATION REQUIRED" &&
    rollbackNeedsApproval === true &&
    rolled.status === "LIVE" &&
    domain.status === "UNVERIFIED";

  console.log("PASS_V4_4", pass);
  if (!pass) {
    console.log("FAIL_DETAIL", {
      build: build.ok,
      preview: preview.deployment.status,
      health: preview.deployment.healthCheckPassed,
      gate: gate.ok,
      prodBlocked: prod.blocked,
      rollbackNeedsApproval,
      rolled: rolled.status,
      domain: domain.status,
    });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
