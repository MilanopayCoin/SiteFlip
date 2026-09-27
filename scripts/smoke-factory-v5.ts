/**
 * V5 smoke — IDEA → … → LIVE, then post-live roadmap snapshot.
 */
import { createFactoryProject, getOutputByAgent } from "../src/lib/factory/store";
import { runFactoryPipeline } from "../src/lib/factory/orchestrator-v3";
import { goGeneratedAppLive } from "../src/lib/factory/orchestrator-v5";
import {
  attemptV5PostLiveGate,
  getV5PostLiveSnapshot,
} from "../src/lib/factory/v5-post-live";
import { getPipelineSteps } from "../src/lib/factory/types";
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
  process.env.JIY_PREVIEW_VERIFY = "inprocess";
  console.log("BRAND", BRAND.fullName, BRAND.url);
  console.log("V5 pipeline + post-live smoke");
  console.log(
    "steps",
    getPipelineSteps("v5")
      .map((s) => s.label)
      .join(" → ")
  );

  const project = createFactoryProject(
    {
      idea: "Create a booking SaaS for mobile bike repair shops in Amsterdam.",
      budget: "€1500",
      targetRevenue: "€800 MRR",
      country: "Netherlands",
      targetCustomer: "Mobile bike repair shops",
      businessType: "SaaS",
      businessModel: "B2B SaaS",
    },
    "demo-user",
    "v5"
  );

  const result = await runFactoryPipeline(project.id);
  console.log("state", result.state, "step", result.currentStep);
  console.log(
    "pre_live",
    result.tasks
      .filter((t) =>
        [
          "IDEA",
          "GENERATE",
          "SANDBOX",
          "BUILD",
          "TEST",
          "SECURITY",
          "PREVIEW",
          "APPROVAL",
          "LIVE",
        ].includes(t.stepId)
      )
      .map((t) => `${t.stepId}:${t.status}`)
      .join(" | ")
  );

  const code = getOutputByAgent(result, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
  console.log("files", code?.files?.length ?? 0);

  const liveApproval = result.approvals.find(
    (a) => a.action === "generated_app_live" && a.status === "PENDING"
  );
  if (!liveApproval) throw new Error("Missing generated_app_live approval");
  liveApproval.status = "APPROVED";
  liveApproval.resolvedAt = new Date().toISOString();

  const live = await goGeneratedAppLive(result.id);
  console.log("live_state", live.state);
  if (live.state !== "LIVE") throw new Error(`Expected LIVE, got ${live.state}`);
  if (live.sandbox.productionUrl) {
    throw new Error("Must not set productionUrl without isolation");
  }

  const snap = getV5PostLiveSnapshot(live);
  console.log("YOU_ARE_HERE", snap.youAreHereLabel);
  console.log("marker", snap.currentMarker);
  console.log(
    "gates",
    snap.gates.map((g) => `${g.id}:${g.status}`).join(" | ")
  );

  if (snap.youAreHereLabel !== "GENERATED APP LIVE") {
    throw new Error(`Expected YOU ARE HERE at GENERATED APP LIVE, got ${snap.youAreHereLabel}`);
  }
  if (snap.nextActionable !== "PRODUCTION_ISOLATION") {
    throw new Error(`Expected next PRODUCTION_ISOLATION, got ${snap.nextActionable}`);
  }

  const isolation = await attemptV5PostLiveGate(
    live.id,
    "PRODUCTION_ISOLATION"
  );
  console.log("isolation_ok", isolation.ok, isolation.message.slice(0, 80));
  if (isolation.ok) {
    throw new Error("Isolation must stay blocked on Free");
  }

  const growth = await attemptV5PostLiveGate(live.id, "GROWTH");
  console.log("growth_ok", growth.ok);
  if (!growth.ok) throw new Error("Growth draft should succeed");

  console.log("V5_POST_LIVE_SMOKE_OK");
}

main().catch((err) => {
  console.error("V5_SMOKE_FAIL", err);
  process.exit(1);
});
