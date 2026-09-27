/**
 * Local acceptance: Fast Create → artifact → /generated HTML runtime.
 * Does not require Cloudflare deploy. Uses in-memory factory store.
 */
import { createFactoryProject, getFactoryProject } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import {
  GENERATED_APP_MARKER,
  serveGeneratedApp,
  generatedPathFor,
} from "../src/lib/factory/generated-runtime";

const IDEA =
  "Create a booking SaaS for cleaning companies in the Netherlands.";

async function main() {
  process.env.AI_PROVIDER = process.env.AI_PROVIDER || "heuristic";

  const project = createFactoryProject({
    idea: IDEA,
    country: "Netherlands",
    targetCustomer: "Dutch cleaning companies",
    budget: "€2,000",
    targetRevenue: "€1,500 MRR",
    businessType: "SaaS",
    businessModel: "Subscription SaaS",
    preferredTechnology: "Next.js, Supabase, Mollie",
    workloadPreference: "Part-time",
  });
  project.pipelineVersion = "v5";
  project.sandbox.createMode = "fast";

  const result = await runFactoryPipeline(project.id, { fastCreate: true });
  const artifact = result.sandbox.runtimeArtifact;
  const previewUrl = result.sandbox.previewUrl;

  const pages = [
    "landing",
    "register",
    "login",
    "dashboard",
    "customers",
    "services",
    "bookings",
    "calendar",
    "settings",
  ];

  const pageResults: Record<string, { status: number; marker: boolean; titleHit: boolean }> =
    {};
  for (const p of pages) {
    const res = await serveGeneratedApp({
      projectId: result.id,
      pageRaw: p === "landing" ? null : p,
    });
    const html = await res.text();
    pageResults[p] = {
      status: res.status,
      marker: html.includes(GENERATED_APP_MARKER),
      titleHit: html.includes(result.name) || html.toLowerCase().includes(p),
    };
  }

  // Simulate "new session" / no client cache: drop memory then recover via ensure from
  // re-saved project only (still local). Clear Map by re-saving after wipe is not possible
  // without store API — instead re-fetch from getFactoryProject after serve (same process).
  const again = getFactoryProject(result.id);
  const refreshRes = await serveGeneratedApp({ projectId: result.id });
  const refreshHtml = await refreshRes.text();

  const report = {
    PROJECT_LOAD: again ? "PASS" : "FAIL",
    ARTIFACT: artifact?.artifactId ? "PASS" : "FAIL",
    BUILD:
      result.tasks.find((t) => t.stepId === "BUILD")?.status === "COMPLETED"
        ? "PASS"
        : "FAIL",
    PREVIEW_PATH: previewUrl === generatedPathFor(result.id) ? "PASS" : "FAIL",
    PREVIEW_HTTP_200: pageResults.landing.status === 200 ? "PASS" : "FAIL",
    PREVIEW_MARKER: pageResults.landing.marker ? "PASS" : "FAIL",
    NAV_PAGES: Object.values(pageResults).every((r) => r.status === 200 && r.marker)
      ? "PASS"
      : "FAIL",
    REFRESH: refreshRes.status === 200 && refreshHtml.includes(GENERATED_APP_MARKER)
      ? "PASS"
      : "FAIL",
    APPROVAL_GATE:
      result.state === "APPROVAL_REQUIRED" &&
      result.approvals.some((a) => a.action === "generated_app_live" && a.status === "PENDING")
        ? "PASS"
        : "FAIL",
    entrypoint: previewUrl,
    artifact,
    state: result.state,
    pageResults,
  };

  console.log(JSON.stringify(report, null, 2));
  const failed = Object.entries(report).filter(
    ([k, v]) => k === k.toUpperCase() && v === "FAIL"
  );
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
