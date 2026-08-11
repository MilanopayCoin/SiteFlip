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
      "You are SITEFLIP ArchitectureAgent. Convert Product Spec into Technical Specification JSON using Next.js/Supabase/Stripe stack where appropriate.",
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
  return {
    frontend: [
      "Next.js App Router",
      "TypeScript",
      "Tailwind CSS",
      "shadcn/ui-style components",
    ],
    backend: ["Next.js Route Handlers", "Server Components", "Zod validation"],
    database: ["PostgreSQL via isolated Supabase schema/project", ...product.databaseRequirements],
    authentication: ["Supabase Auth", "RLS", "Secure cookies"],
    apis: product.apiRequirements,
    thirdPartyIntegrations: ["Stripe (architecture)", "Resend/email (optional)", "OpenAI (optional)"],
    fileStorage: ["Supabase Storage in sandbox bucket prefix"],
    payments: [
      "Stripe Checkout architecture",
      "Customer portal architecture",
      "Webhooks — not activated without approval",
      "Stripe payments are NOT escrow",
    ],
    email: ["Transactional email provider abstraction"],
    analytics: ["Privacy-friendly analytics placeholder"],
    security: [
      "Sandbox isolation from SITEFLIP core DB",
      "No secrets in client",
      "RLS on all user tables",
      "Generated code treated as untrusted until tested",
    ],
    techStack: preferred.split(/,\s*/),
    labeledAssumptions: [
      "Stack defaults to SITEFLIP-compatible technologies",
      "Isolated sandbox required before any deploy",
    ],
  };
}
