/**
 * Debug Groq structured JSON for BusinessAgent.
 */
import fs from "fs";
import path from "path";
import { aiJson } from "../src/lib/ai/providers";
import { businessPlanSchema } from "../src/lib/factory/schemas";

const envPath = path.join(__dirname, "..", ".dev.vars");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.AI_PROVIDER = "groq";

async function main() {
  const result = await aiJson(
    "You are SITEFLIP BusinessAgent. Return ONLY valid JSON for a business plan. Required keys: businessName, businessDescription, businessModel, targetCustomer, problem, solution, valueProposition, revenueModel, mainCompetitors, growthOpportunities, pricing (tiers array with name, priceMonthlyEur, features), mvpScope, growthStrategy, risks, keyRisks, labeledAssumptions.",
    {
      idea: "AI-powered marketplace where Dutch small businesses can create and sell websites",
    },
    businessPlanSchema,
    () =>
      ({
        businessName: "Fallback",
        businessDescription: "d",
        businessModel: "m",
        targetCustomer: "t",
        problem: "p",
        solution: "s",
        valueProposition: "v",
        revenueModel: "r",
        mainCompetitors: [],
        growthOpportunities: [],
        pricing: { tiers: [{ name: "Starter", priceMonthlyEur: 29, features: ["a"] }] },
        mvpScope: ["mvp"],
        growthStrategy: ["g"],
        risks: ["r"],
        keyRisks: ["k"],
        labeledAssumptions: ["a"],
      }) as never
  );
  console.log(
    JSON.stringify(
      {
        provider: result.provider,
        model: result.model,
        businessName: (result.data as { businessName?: string }).businessName,
        rawSnippet: result.raw?.slice(0, 400),
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
