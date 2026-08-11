import { NextResponse } from "next/server";
import { z } from "zod";
import { computeValuation } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const valuateSchema = z.object({
  category: z.string().min(1),
  monthlyRevenue: z.coerce.number().min(0),
  monthlyProfit: z.coerce.number(),
  monthlyTraffic: z.coerce.number().min(0),
  growthRate: z.coerce.number(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:valuate:${ip}`, 20, 60_000);
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
    const parsed = valuateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const valuation = computeValuation(parsed.data);
    return NextResponse.json(valuation);
  } catch (error) {
    console.error("[api/ai/valuate]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
