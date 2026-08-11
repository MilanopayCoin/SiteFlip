import { NextResponse } from "next/server";
import { computeValuation } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sellListingSchema } from "@/lib/validations";
import { CATEGORY_LABELS, VALUATION_DISCLAIMER } from "@/lib/utils";

function generateListingDraft(
  input: {
    name: string;
    businessType: string;
    revenue: number;
    profit: number;
    traffic: number;
    growth: number;
    reasonForSelling: string;
    askingPrice: number;
    description?: string;
    domain?: string;
    technology?: string;
  },
  valuation: ReturnType<typeof computeValuation>
) {
  const categoryLabel =
    CATEGORY_LABELS[input.businessType] ?? input.businessType;
  const margin =
    input.revenue > 0 ? Math.round((input.profit / input.revenue) * 100) : 0;

  const title = `${input.name} — ${categoryLabel} for Sale`;
  const summary = [
    input.description?.trim() ||
      `Established ${categoryLabel.toLowerCase()} generating €${input.revenue.toLocaleString()}/mo revenue.`,
    input.traffic > 0
      ? `${input.traffic.toLocaleString()} monthly visits.`
      : null,
    input.growth !== 0
      ? `${input.growth > 0 ? "Growing" : "Declining"} at ${Math.abs(input.growth)}% MoM.`
      : null,
    `Asking €${input.askingPrice.toLocaleString()}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const riskFactors: string[] = [];
  if (input.revenue === 0) riskFactors.push("No reported revenue");
  if (margin < 20 && input.revenue > 0)
    riskFactors.push(`Low profit margin (${margin}%)`);
  if (input.growth < 0) riskFactors.push("Negative growth trend");
  if (valuation.risk_score > 50) riskFactors.push("Elevated AI risk score");
  if (!input.domain) riskFactors.push("Domain not specified");

  const riskAnalysis =
    riskFactors.length > 0
      ? `Key risks: ${riskFactors.join("; ")}. Seller reason: ${input.reasonForSelling}`
      : `Moderate risk profile. Seller reason: ${input.reasonForSelling}`;

  return {
    title,
    summary,
    risk_analysis: riskAnalysis,
    suggested_price_range: {
      minimum: valuation.minimum_value,
      estimated: valuation.estimated_value,
      maximum: valuation.maximum_value,
    },
    tech_stack: input.technology
      ? input.technology.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    domain: input.domain ?? null,
  };
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:listing:${ip}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = sellListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const valuation = computeValuation({
      category: input.businessType,
      monthlyRevenue: input.revenue,
      monthlyProfit: input.profit,
      monthlyTraffic: input.traffic,
      growthRate: input.growth,
    });

    const listingDraft = generateListingDraft(input, valuation);

    return NextResponse.json({
      listing_draft: listingDraft,
      valuation,
      disclaimer: VALUATION_DISCLAIMER,
    });
  } catch (error) {
    console.error("[api/ai/listing]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
