import {
  securityReviewSchema,
  type ArchitectureSpec,
  type SecurityReview,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runSecurityAgent(architecture: ArchitectureSpec) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP SecurityAgent. Review architecture for sandbox safety. Never suggest bypassing RLS, leaking secrets, or auto-deploying. Return JSON matching the schema. Label all unverified items as AI_HYPOTHESIS.",
    user: { architecture },
    schema: securityReviewSchema,
    heuristic: () => heuristicSecurity(architecture),
  });
}

function heuristicSecurity(architecture: ArchitectureSpec): SecurityReview {
  return {
    risks: [
      "Generated landing code could include unsafe patterns if not scanned",
      "Payment activation without approval would create real-money risk",
      "Shared production secrets must never be injected into sandbox projects",
    ],
    mitigations: [
      "Keep factory outputs in isolated sandbox storage prefixes",
      "Require human approval for deploy, payments, domain, and marketplace publish",
      "Scan generated content for forbidden secret/env access patterns",
      ...(architecture.securityConsiderations || architecture.security).slice(0, 3),
    ],
    rlsRequirements: [
      "All user-owned tables must enable RLS",
      "Owners may only read/write their own factory project rows",
      "Service role must not be exposed to client or generated landing code",
    ],
    secretHandling: [
      "Never embed API keys in generated landing pages",
      "Never read SITEFLIP production Worker secrets from sandbox code",
      "Payment keys remain server-only after explicit approval",
    ],
    sandboxBoundaries: [
      `Isolated schema/project strategy required`,
      "No access to unrelated users' businesses, messages, or transactions",
      "No automatic production database migrations from factory agents",
    ],
    forbiddenActions: [
      "Auto-deploy to production",
      "Auto-enable payments",
      "Auto-connect domains",
      "Bypass Supabase RLS",
      "Access SITEFLIP production secrets",
    ],
    labeledAssumptions: [
      "[AI_HYPOTHESIS] Security review is heuristic without a live threat model",
      "[VERIFIED] Factory V1 does not auto-deploy or auto-activate payments",
    ],
  };
}
