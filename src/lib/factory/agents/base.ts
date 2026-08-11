import { getOpenAI } from "@/lib/ai";
import type { z } from "zod";

export async function runStructuredAgent<T>(opts: {
  system: string;
  user: unknown;
  schema: z.ZodType<T>;
  heuristic: () => T;
}): Promise<{ data: T; source: "openai" | "heuristic"; assumptions: string[] }> {
  const openai = getOpenAI();
  if (!openai) {
    const data = opts.heuristic();
    return {
      data,
      source: "heuristic",
      assumptions: extractAssumptions(data),
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: JSON.stringify(opts.user) },
      ],
    });
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      const data = opts.heuristic();
      return {
        data,
        source: "heuristic",
        assumptions: [
          "OpenAI response failed Zod validation — used heuristic fallback",
          ...extractAssumptions(data),
        ],
      };
    }
    return {
      data: parsed.data,
      source: "openai",
      assumptions: extractAssumptions(parsed.data),
    };
  } catch {
    const data = opts.heuristic();
    return {
      data,
      source: "heuristic",
      assumptions: [
        "OpenAI call failed — used heuristic fallback",
        ...extractAssumptions(data),
      ],
    };
  }
}

function extractAssumptions(data: unknown): string[] {
  if (data && typeof data === "object" && "labeledAssumptions" in data) {
    const a = (data as { labeledAssumptions?: unknown }).labeledAssumptions;
    if (Array.isArray(a)) return a.map(String);
  }
  if (data && typeof data === "object" && "aiHypotheses" in data) {
    const a = (data as { aiHypotheses?: unknown }).aiHypotheses;
    if (Array.isArray(a)) return a.map(String);
  }
  return [];
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "venture";
}
