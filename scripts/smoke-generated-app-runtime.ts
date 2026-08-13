/**
 * V5.1 generated-app runtime smoke.
 * Exact idea: Create a booking SaaS for cleaning companies in the Netherlands.
 */
import { createFactoryProject, getOutputByAgent } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import { goGeneratedAppLive } from "../src/lib/factory/orchestrator-v5";
import {
  REQUIRED_APP_PAGES,
  getGeneratedAppArtifact,
  hasApplicationEntrypoint,
  isValidGeneratedAppHtml,
  renderGeneratedAppHtml,
  renderProjectNotFoundHtml,
} from "../src/lib/factory/generated-app-runtime";
import type { CodeArtifact } from "../src/lib/factory/schemas";

async function main() {
  process.env.AI_PROVIDER = "heuristic";
  process.env.JIY_PREVIEW_VERIFY = "inprocess";

  const idea = "Create a booking SaaS for cleaning companies in the Netherlands.";
  const project = createFactoryProject(
    {
      idea,
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

  const generated = await runFactoryPipeline(project.id, { fastCreate: true });
  if (generated.state !== "APPROVAL_REQUIRED") {
    throw new Error(`Expected APPROVAL_REQUIRED, got ${generated.state}`);
  }

  const artifact = getGeneratedAppArtifact(generated);
  if (!hasApplicationEntrypoint(artifact)) {
    throw new Error("ARTIFACT missing entrypoint");
  }
  if (artifact!.entrypoint !== `/preview/${generated.id}`) {
    throw new Error(`Unexpected entrypoint ${artifact!.entrypoint}`);
  }

  const code = getOutputByAgent(generated, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  if (!code?.files?.length) throw new Error("BUILD produced no files");

  const missingPages = REQUIRED_APP_PAGES.filter(
    (page) => !artifact!.pages.some((p) => p.toLowerCase() === page.toLowerCase())
  );
  if (missingPages.length) {
    throw new Error(`Missing pages: ${missingPages.join(", ")}`);
  }

  const slugs = [
    "",
    "register",
    "login",
    "dashboard",
    "customers",
    "services",
    "bookings",
    "calendar",
    "settings",
  ];
  for (const slug of slugs) {
    const { html } = renderGeneratedAppHtml(
      generated,
      slug ? [slug] : []
    );
    if (!isValidGeneratedAppHtml(html)) {
      throw new Error(`Invalid HTML for /preview/${generated.id}/${slug}`);
    }
    if (!html.includes("GENERATED_APP_OK")) {
      throw new Error(`Missing GENERATED_APP_OK on ${slug || "landing"}`);
    }
  }

  const notFound = renderProjectNotFoundHtml("missing-id");
  if (!notFound.includes("PROJECT NOT FOUND")) {
    throw new Error("PROJECT NOT FOUND html missing");
  }

  const liveApproval = generated.approvals.find(
    (a) => a.action === "generated_app_live" && a.status === "PENDING"
  );
  if (!liveApproval) throw new Error("Missing generated_app_live approval");
  liveApproval.status = "APPROVED";
  liveApproval.resolvedAt = new Date().toISOString();

  const live = await goGeneratedAppLive(generated.id);
  if (live.state !== "LIVE") {
    throw new Error(`Expected LIVE, got ${live.state} ${live.sandbox.runtimeError?.message || ""}`);
  }
  if (live.sandbox.previewUrl !== `/preview/${live.id}`) {
    throw new Error(`LIVE URL ${live.sandbox.previewUrl}`);
  }

  console.log(
    JSON.stringify(
      {
        projectId: live.id,
        businessId: artifact!.businessId,
        version: artifact!.version,
        buildId: artifact!.buildId,
        entrypoint: artifact!.entrypoint,
        pages: artifact!.pages,
        state: live.state,
        preview: live.sandbox.previewUrl,
      },
      null,
      2
    )
  );
  console.log("GENERATED_APP_RUNTIME_SMOKE_OK");
}

main().catch((err) => {
  console.error("GENERATED_APP_RUNTIME_SMOKE_FAIL", err);
  process.exit(1);
});
