import {
  architectureSchema,
  type ArchitectureSpec,
  type FactoryBriefInput,
  type ProductSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runArchitectureAgent(
  brief: FactoryBriefInput,
  product: ProductSpec
) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP ArchitectureAgent. Convert Product Spec into Technical Specification JSON. Include hosting, securityConsiderations, apiStructure, estimatedComplexity. Do NOT deploy anything.",
    user: { brief, product },
    schema: architectureSchema,
    heuristic: () => heuristicArchitecture(brief, product),
  });
}

function heuristicArchitecture(
  brief: FactoryBriefInput,
  product: ProductSpec
): ArchitectureSpec {
  const preferred =
    brief.preferredTechnology ||
    "Next.js, TypeScript, Tailwind, Supabase, Stripe, Vercel";
  const complexity =
    brief.workloadPreference?.toLowerCase().includes("full") ||
    brief.availableTime?.toLowerCase().includes("full")
      ? "medium"
      : "medium";
  return {
    frontend: [
      "Next.js App Router",
      "TypeScript",
      "Tailwind CSS",
      "shadcn/ui-style components",
    ],
    backend: ["Next.js Route Handlers", "Server Components", "Zod validation"],
    database: [
      "PostgreSQL via isolated Supabase schema/project",
      ...product.databaseRequirements,
    ],
    authentication: ["Supabase Auth", "RLS", "Secure cookies"],
    apis: product.apiRequirements,
    apiStructure: [
      "REST Route Handlers under /api",
      "Zod request validation",
      "Auth-gated mutations",
    ],
    thirdPartyIntegrations: [
      "Stripe (architecture only)",
      "Resend/email (optional)",
      "AI provider via SITEFLIP abstraction (optional)",
    ],
    fileStorage: ["Supabase Storage in sandbox bucket prefix"],
    payments: [
      "Stripe Checkout architecture",
      "Customer portal architecture",
      "Webhooks — not activated without approval",
      "Payments are NOT escrow",
    ],
    email: ["Transactional email provider abstraction"],
    analytics: ["Privacy-friendly analytics placeholder"],
    hosting: ["Cloudflare Workers / Vercel-compatible preview", "Isolated sandbox only until approval"],
    security: [
      "Sandbox isolation from SITEFLIP core DB",
      "No secrets in client",
      "RLS on all user tables",
      "Generated code treated as untrusted until tested",
    ],
    securityConsiderations: [
      "Never inject SITEFLIP production secrets into sandbox apps",
      "Require approval for deploy, payments, domain, listing publish",
      "Scan generated artifacts for forbidden patterns",
    ],
    estimatedComplexity: complexity as "low" | "medium" | "high",
    techStack: preferred.split(/,\s*/),
    labeledAssumptions: [
      "[AI_HYPOTHESIS] Stack defaults to SITEFLIP-compatible technologies",
      "[VERIFIED] Architecture docs do not deploy infrastructure automatically",
    ],
  };
}
