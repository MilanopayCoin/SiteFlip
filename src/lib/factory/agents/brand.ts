import {
  brandSchema,
  type BrandPlan,
  type BusinessPlan,
  type FactoryBriefInput,
} from "../schemas";
import { runStructuredAgent, slugifyName } from "./base";

export async function runBrandAgent(
  brief: FactoryBriefInput,
  plan: BusinessPlan
) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP BrandAgent. Return brand system JSON. Do NOT claim domain availability.",
    user: { brief, plan },
    schema: brandSchema,
    heuristic: () => heuristicBrand(brief, plan),
  });
}

function heuristicBrand(brief: FactoryBriefInput, plan: BusinessPlan): BrandPlan {
  const slug = slugifyName(plan.businessName);
  return {
    brandName: plan.businessName,
    tagline: `Built for ${brief.targetCustomer}`,
    brandDescription: `${plan.businessName} helps ${brief.targetCustomer} solve: ${plan.problem.slice(0, 100)}`,
    colorDirection: {
      primary: "#8B5CF6",
      secondary: "#6366F1",
      accent: "#34D399",
      background: "#07070C",
    },
    typography: {
      display: "Geist Sans / premium sans",
      body: "Geist Sans",
    },
    logoConcept: `Minimal wordmark "${plan.businessName}" with a simple geometric mark suggesting flow/automation.`,
    brandVoice: ["Clear", "Confident", "Practical", "Trustworthy"],
    domainSuggestions: [`${slug}.com`, `${slug}.io`, `get${slug}.com`],
    socialHandleSuggestions: [`@${slug}`, `@get${slug}`],
    domainAvailabilityNote:
      "Domain suggestions are NOT availability-checked. Connect a real domain provider before claiming availability.",
    labeledAssumptions: [
      "Color/typography recommendations are design hypotheses",
      "Social handles may already be taken",
    ],
  };
}
