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
      "You are SITEFLIP BrandAgent. Return brand system JSON with exactly 3 brandNameOptions. Do NOT claim domain availability unless actually verified (it is not).",
    user: { brief, plan },
    schema: brandSchema,
    heuristic: () => heuristicBrand(brief, plan),
  });
}

function heuristicBrand(brief: FactoryBriefInput, plan: BusinessPlan): BrandPlan {
  const slug = slugifyName(plan.businessName);
  const options = [
    plan.businessName,
    `${plan.businessName} Lab`,
    `${slug.charAt(0).toUpperCase()}${slug.slice(1)}ly`,
  ];
  return {
    brandName: plan.businessName,
    brandNameOptions: options,
    tagline: `Built for ${brief.targetCustomer}`,
    brandDescription: `${plan.businessName} helps ${brief.targetCustomer} solve: ${plan.problem.slice(0, 100)}`,
    brandPositioning: `The practical ${brief.businessType} for ${brief.targetCustomer} in ${brief.country}.`,
    tone: ["Clear", "Confident", "Practical"],
    visualDirection:
      "Dark premium UI with calm accents — product-first, low clutter, mobile-first composition.",
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
      "Domain suggestions are NOT availability-checked. Do not claim availability until a domain provider verifies it.",
    labeledAssumptions: [
      "[AI_HYPOTHESIS] Color/typography recommendations are design hypotheses",
      "[AI_HYPOTHESIS] Social handles and domains may already be taken",
      "[VERIFIED] No domain WHOIS/availability API was called",
    ],
  };
}
