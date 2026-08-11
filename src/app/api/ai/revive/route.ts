import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRevivalPlan } from "@/lib/ai";
import { getBusinessById } from "@/lib/data/demo";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const reviveSchema = z.object({
  businessId: z.string().min(1),
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

    const business = getBusinessById(parsed.data.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }

    const plan = await generateRevivalPlan({
      name: business.name,
      category: business.category,
      original_story: business.original_story,
      current_condition: business.current_condition,
      monthly_traffic: business.monthly_traffic,
      technology_stack: business.technology_stack,
      domain_age_years: business.domain_age_years,
    });

    return NextResponse.json({
      business_id: business.id,
      plan,
      verified_data: plan.verified_data,
      seller_claims: plan.seller_claims,
      ai_assumptions: plan.ai_assumptions,
    });
  } catch (error) {
    console.error("[api/ai/revive]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
