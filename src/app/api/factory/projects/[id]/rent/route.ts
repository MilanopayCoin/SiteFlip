import { NextResponse } from "next/server";
import { getFactoryProject, getOutputByAgent } from "@/lib/factory/store";
import type { BusinessPlan } from "@/lib/factory/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = getFactoryProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = getOutputByAgent(project, "BusinessAgent")?.data as
    | BusinessPlan
    | undefined;
  const starter = plan?.pricing.tiers[0]?.priceMonthlyEur ?? 19;

  // Estimate only — no fabricated revenue
  const suggestedRentMin = Math.max(49, Math.round(starter * 2));
  const suggestedRentMax = Math.max(99, Math.round(starter * 5));

  return NextResponse.json({
    suggestedRentalRangeEurMonthly: {
      min: suggestedRentMin,
      max: suggestedRentMax,
    },
    estimateNote:
      "Suggested rental range is an estimate from planned pricing heuristics — not based on verified revenue.",
    configurable: {
      monthlyRentalPrice: suggestedRentMin,
      contractPeriodMonths: 12,
      rentToOwn: {
        enabled: false,
        creditPercent: 40,
        note: "Optional — seller configurable. Not an automatic legally binding ownership transfer.",
      },
    },
    listPath: `/rent?fromFactory=${project.id}`,
    assumptions: [
      "No verified MRR — estimate only",
      "Flexible contract architecture only",
    ],
  });
}
