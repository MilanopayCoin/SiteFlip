/**
 * Live-test Factory V1 with the Dutch SMB website marketplace idea.
 */
import { createFactoryProject } from "../src/lib/factory/store";
import { BusinessFactoryOrchestrator } from "../src/lib/factory/orchestrator";
import fs from "fs";
import path from "path";

const envPath = path.join(__dirname, "..", ".dev.vars");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const IDEA =
  "I want to build an AI-powered marketplace where Dutch small businesses can create and sell websites.";

async function main() {
  process.env.AI_PROVIDER = process.env.AI_PROVIDER || "groq";
  const project = createFactoryProject({
    idea: IDEA,
    country: "Netherlands",
    targetCustomer: "Dutch small businesses",
    budget: "€3,000",
    targetRevenue: "€2,000 MRR",
    businessType: "Marketplace",
    businessModel: "Marketplace commission + SaaS tools",
    preferredTechnology: "Next.js, Supabase, Mollie",
    workloadPreference: "Part-time",
  });

  const result = await new BusinessFactoryOrchestrator(project.id).runPipeline();

  const steps = result.tasks.map((t) => `${t.stepId}:${t.status}`);
  const market = result.outputs.find((o) => o.agent === "MarketAgent")?.data as
    | {
        claims?: Array<{ claimClass: string }>;
        aiHypotheses?: string[];
        verifiedResearch?: string[];
      }
    | undefined;
  const brand = result.outputs.find((o) => o.agent === "BrandAgent");
  const product = result.outputs.find((o) => o.agent === "ProductAgent");
  const tech = result.outputs.find((o) => o.agent === "ArchitectureAgent")?.data as
    | { payments?: string[]; thirdPartyIntegrations?: string[] }
    | undefined;
  const landing = result.outputs.find((o) => o.agent === "DeveloperAgent")?.data as
    | { completeness?: string }
    | undefined;
  const content = result.outputs.find((o) => o.agent === "ContentAgent")?.data as
    | { hero?: { headline?: string } }
    | undefined;
  const payment = result.outputs.find((o) => o.agent === "PaymentAgent")?.data as
    | { notes?: string[]; labeledAssumptions?: string[] }
    | undefined;

  const stripeHits = JSON.stringify({
    tech,
    payment,
    outputs: result.outputs.map((o) => o.agent),
  }).match(/Stripe/gi);

  console.log(
    JSON.stringify(
      {
        state: result.state,
        persistenceMode: result.persistenceMode,
        steps,
        aiScore: result.quality?.overall ?? null,
        explanations: result.quality?.explanations?.length ?? 0,
        passport: result.passport?.businessName ?? null,
        lifecycle: result.passport?.lifecycle ?? null,
        landingCompleteness: landing?.completeness ?? null,
        hero: content?.hero?.headline ?? null,
        marketClaims: market?.claims?.map((c) => c.claimClass) ?? [],
        aiHypothesesCount: market?.aiHypotheses?.length ?? 0,
        verifiedResearchCount: market?.verifiedResearch?.length ?? 0,
        brand: Boolean(brand),
        product: Boolean(product),
        techPayments: tech?.payments ?? [],
        paymentNotes: payment?.notes ?? [],
        stripeMentions: stripeHits?.length ?? 0,
        approvals: result.approvals.map((a) => a.action),
        agentSources: [
          ...new Set(result.outputs.map((o) => `${o.agent}:${o.source}`)),
        ],
        PASS_FLOW: ["APPROVAL_REQUIRED", "READY", "PREVIEW"].includes(result.state),
        PASS_SCORE_EXPLAIN: (result.quality?.explanations?.length ?? 0) > 0,
        PASS_PASSPORT: Boolean(result.passport),
        PASS_LANDING: landing?.completeness === "landing_page_only" && Boolean(content?.hero),
        PASS_NO_STRIPE_PROVIDER: (stripeHits?.length ?? 0) === 0,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
