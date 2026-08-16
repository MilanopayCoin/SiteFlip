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
      "You are SITEFLIP ProductAgent. Return a structured Product Specification JSON for an MVP including coreProduct, mvpFeatures, futureFeatures, userRoles, journeys, monetization, and mvpScope.",
    user: { brief, plan },
    schema: productSpecSchema,
    heuristic: () => heuristicProduct(brief, plan),
  });
}

function heuristicProduct(
  brief: FactoryBriefInput,
  plan: BusinessPlan
): ProductSpec {
  const isBooking =
    /book/i.test(brief.idea) ||
    /clean/i.test(brief.idea) ||
    plan.mvpScope.some((s) => /book|calendar|customer|service/i.test(s));

  const bookingPages = [
    "Landing",
    "Register",
    "Login",
    "Dashboard",
    "Customers",
    "Services",
    "Bookings",
    "Calendar",
    "Settings",
  ];

  return {
    coreProduct: plan.solution,
    mvpFeatures: isBooking
      ? [
          "Customer management",
          "Service catalog",
          "Booking CRUD",
          "Calendar view",
          "Demo authentication",
          "Settings",
        ]
      : plan.mvpScope,
    futureFeatures: [
      "Team collaboration",
      "Advanced automations",
      "Integrations marketplace",
      "White-label options",
    ],
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
    pages: isBooking
      ? bookingPages
      : [
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
    monetization: [
      plan.revenueModel,
      ...plan.pricing.tiers.map(
        (t) => `${t.name}: €${t.priceMonthlyEur}/mo (planned pricing — not live)`
      ),
    ],
    mvpScope: plan.mvpScope,
    databaseRequirements: isBooking
      ? ["profiles", "companies", "customers", "services", "bookings"]
      : [
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
      "[AI_HYPOTHESIS] MVP feature set derived from business plan — not user-validated",
      isBooking
        ? "[VERIFIED] V3 generates starter mini-SaaS scaffold for booking workflow"
        : "[VERIFIED] V3 generates starter MVP scaffold from product spec",
    ],
  };
}
