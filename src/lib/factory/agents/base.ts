import { aiJson } from "@/lib/ai/providers";
import type { z } from "zod";
import type { FactoryOutputSource } from "../types";

export async function runStructuredAgent<T>(opts: {
  system: string;
  user: unknown;
  schema: z.ZodType<T>;
  heuristic: () => T;
}): Promise<{
  data: T;
  source: FactoryOutputSource;
  assumptions: string[];
  model?: string;
}> {
  const result = await aiJson(opts.system, opts.user, opts.schema, opts.heuristic);
  const source = (result.provider || "heuristic") as FactoryOutputSource;
  const assumptions = extractAssumptions(result.data);
  if (source === "heuristic") {
    assumptions.unshift("HEURISTIC / AI FALLBACK — not verified research");
    assumptions.unshift(
      `[AI_HYPOTHESIS] ${
        (result as { fallbackReason?: string }).fallbackReason ||
        "Structured AI output unavailable after Zod retry"
      }`
    );
    // Tag labeledAssumptions on data when possible
    if (result.data && typeof result.data === "object") {
      const obj = result.data as Record<string, unknown>;
      if (Array.isArray(obj.labeledAssumptions)) {
        obj.labeledAssumptions = [
          "HEURISTIC / AI FALLBACK",
          ...obj.labeledAssumptions.map(String),
        ];
      }
      if (Array.isArray(obj.verifiedResearch)) {
        // Never present heuristic as verified
        obj.verifiedResearch = [
          "No verified research — HEURISTIC / AI FALLBACK used for this agent",
        ];
      }
    }
  }
  return {
    data: result.data,
    source,
    assumptions: [...new Set(assumptions)],
    model: result.model,
  };
}

function extractAssumptions(data: unknown): string[] {
  const out: string[] = [];
  if (!data || typeof data !== "object") return out;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.labeledAssumptions)) {
    out.push(...obj.labeledAssumptions.map(String));
  }
  if (Array.isArray(obj.aiHypotheses)) {
    out.push(...obj.aiHypotheses.map((h) => `[AI_HYPOTHESIS] ${h}`));
  }
  if (Array.isArray(obj.claims)) {
    for (const c of obj.claims) {
      if (c && typeof c === "object" && "statement" in c && "claimClass" in c) {
        const claim = c as { statement: string; claimClass: string };
        out.push(`[${claim.claimClass}] ${claim.statement}`);
      }
    }
  }
  return out;
}

export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "venture"
  );
}
