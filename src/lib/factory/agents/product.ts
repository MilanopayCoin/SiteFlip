import {
  productSpecSchema,
  type BusinessPlan,
  type FactoryBriefInput,
  type ProductSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runProductAgent(
  brief: FactoryBriefInput,
  plan: BusinessPlan
) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP ProductAgent. Return a structured Product Specification JSON for an MVP.",
    user: { brief, plan },
    schema: productSpecSchema,
    heuristic: () => heuristicProduct(brief, plan),
  });
}

function heuristicProduct(
  brief: FactoryBriefInput,
  plan: BusinessPlan
): ProductSpec {
  return {
    mvpFeatures: plan.mvpScope,
    userRoles: ["Owner", "Member", "Admin"],
    userJourneys: [
      {
        name: "Signup → first value",
        steps: ["Land", "Sign up", "Complete onboarding", "Create first record", "Upgrade"],
      },
      {
        name: "Returning user",
        steps: ["Login", "Dashboard", "Core workflow", "Settings"],
      },
    ],
    pages: [
      "Landing",
      "Pricing",
      "Login / Signup",
      "Dashboard",
      "Core resource list",
      "Core resource detail",
      "Settings",
      "Billing (architecture)",
    ],
    dashboard: ["KPIs", "Recent activity", "Quick actions", "Upgrade CTA"],
    onboarding: ["Welcome", "Goal selection", "Sample data", "First action checklist"],
    pricingPages: plan.pricing.tiers.map((t) => t.name),
    settings: ["Profile", "Team", "Billing", "Danger zone"],
    coreWorkflows: [
      `Primary ${brief.businessType} create/edit/list flow`,
      "Export / share",
      "Notification hooks",
    ],
    databaseRequirements: [
      "profiles",
      "organizations",
      "memberships",
      "core_entities",
      "subscriptions (reference only until payments activated)",
    ],
    apiRequirements: [
      "Auth session",
      "CRUD core entities",
      "Billing webhook stub",
      "Health check",
    ],
    labeledAssumptions: [
      "MVP feature set derived from business plan — not user-validated",
      "Full app code is not generated in MVP factory; landing + specs first",
    ],
  };
}
