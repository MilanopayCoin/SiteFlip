import {
  planSpecSchema,
  type FactoryBriefInput,
  type PlanSpec,
} from "../schemas";
import { runStructuredAgent, slugifyName } from "./base";

/**
 * PlannerAgent — first V3 stage: idea → structured plan.
 * Modular prompt; does not combine all downstream agents.
 */
export async function runPlannerAgent(brief: FactoryBriefInput) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP PlannerAgent. Convert a business idea into a structured plan JSON with businessName, summary, problem, solution, targetCustomer, businessModel, revenueModel, mvpPages, coreWorkflows, successCriteria, constraints, and pricing tiers. For booking SaaS include Landing, Register, Login, Dashboard, Customers, Services, Bookings, Calendar, Settings. Label unverified items in labeledAssumptions.",
    user: brief,
    schema: planSpecSchema,
    heuristic: () => heuristicPlan(brief),
  });
}

function heuristicPlan(brief: FactoryBriefInput): PlanSpec {
  const isBooking =
    /book/i.test(brief.idea) ||
    /clean/i.test(brief.idea) ||
    /appointment|schedule|calendar/i.test(brief.idea);

  const businessName = isBooking
    ? "CleanBook NL"
    : `${slugifyName(brief.idea.slice(0, 40))} App`;

  const mvpPages = isBooking
    ? [
        "Landing",
        "Register",
        "Login",
        "Dashboard",
        "Customers",
        "Services",
        "Bookings",
        "Calendar",
        "Settings",
      ]
    : [
        "Landing",
        "Register",
        "Login",
        "Dashboard",
        "Core Resource",
        "Settings",
      ];

  return {
    businessName,
    summary: brief.idea,
    problem: isBooking
      ? "Cleaning companies in the Netherlands struggle to manage bookings, staff schedules, and customer records with spreadsheets."
      : "Target customers need a simpler way to run core workflows digitally.",
    solution: isBooking
      ? "A starter booking SaaS with customer management, service catalog, calendar scheduling, and a simple dashboard."
      : "A starter SaaS MVP scaffold with authentication, dashboard, and core CRUD workflows.",
    targetCustomer: brief.targetCustomer || "Small businesses",
    businessModel: brief.businessModel || brief.businessType || "B2B SaaS",
    revenueModel: "Monthly subscription tiers",
    mvpPages,
    coreWorkflows: isBooking
      ? [
          "Register company account",
          "Add customers and services",
          "Create and manage bookings",
          "View calendar schedule",
          "Update settings",
        ]
      : [
          "Sign up and log in",
          "Complete onboarding",
          "Manage core records",
          "View dashboard KPIs",
        ],
    successCriteria: [
      "User can register and log in (demo auth)",
      "Core CRUD pages exist as starter scaffold",
      "API validation and error handling stubs present",
      "Database spec with adapter architecture (not applied)",
    ],
    constraints: [
      "Starter MVP only — not production-ready",
      "No access to SITEFLIP production database or secrets",
      "Payments require separate approval",
      brief.country ? `Localized for ${brief.country}` : "Generic locale",
    ],
    pricing: {
      tiers: [
        {
          name: "Starter",
          priceMonthlyEur: 29,
          features: ["Up to 50 bookings/mo", "1 user", "Email support"],
        },
        {
          name: "Pro",
          priceMonthlyEur: 79,
          features: ["Unlimited bookings", "5 users", "Calendar sync"],
        },
      ],
    },
    labeledAssumptions: [
      "[AI_HYPOTHESIS] MVP scope inferred from idea — user validation required",
      "[VERIFIED] Output is a starter scaffold — not a complete production SaaS",
    ],
  };
}

/** Adapt PlanSpec to BusinessPlan shape for downstream V2-compatible agents */
export function planToBusinessPlan(plan: PlanSpec) {
  return {
    businessName: plan.businessName,
    businessDescription: plan.summary,
    businessModel: plan.businessModel,
    targetCustomer: plan.targetCustomer,
    problem: plan.problem,
    solution: plan.solution,
    valueProposition: plan.solution,
    revenueModel: plan.revenueModel,
    mainCompetitors: [],
    growthOpportunities: [],
    pricing: plan.pricing,
    mvpScope: plan.mvpPages,
    growthStrategy: plan.coreWorkflows,
    risks: plan.constraints,
    keyRisks: plan.constraints,
    labeledAssumptions: plan.labeledAssumptions,
  };
}
