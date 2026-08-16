import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRevivalPlan } from "@/lib/ai";
import { fetchBusinessByIdOrSlug } from "@/lib/data/marketplace-data";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const reviveSchema = z.object({
  businessId: z.string().min(1),
  projectName: z.string().optional(),
  website: z.string().optional(),
  technology: z.string().optional(),
  age: z.coerce.number().optional(),
  currentRevenue: z.coerce.number().optional(),
  traffic: z.coerce.number().optional(),
  whyAbandoned: z.string().optional(),
  askingPrice: z.coerce.number().optional(),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:revive:${ip}`, 20, 60_000);
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
    const parsed = reviveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { business } = await fetchBusinessByIdOrSlug(parsed.data.businessId);
    if (!business && !parsed.data.projectName) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    const plan = await generateRevivalPlan({
      name: business?.name ?? parsed.data.projectName ?? "Untitled",
      category: business?.category ?? "abandoned_saas",
      original_story:
        business?.original_story ?? parsed.data.whyAbandoned ?? null,
      current_condition:
        business?.current_condition ?? parsed.data.description ?? null,
      monthly_traffic: business?.monthly_traffic ?? parsed.data.traffic ?? null,
      technology_stack:
        business?.technology_stack ??
        (parsed.data.technology
          ? parsed.data.technology.split(",").map((t) => t.trim())
          : []),
      domain_age_years: business?.domain_age_years ?? parsed.data.age ?? null,
    });

    return NextResponse.json({
      business_id: business?.id ?? null,
      plan,
      revivalScore: plan.revival_score,
      verified_data: plan.verified_data,
      seller_claims: plan.seller_claims,
      ai_assumptions: plan.ai_assumptions,
      notice:
        "AI hypotheses are labeled. Historical facts are not invented.",
    });
  } catch (error) {
    console.error("[api/ai/revive]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
