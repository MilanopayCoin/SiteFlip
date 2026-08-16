import { NextResponse } from "next/server";
import { matchBusinesses } from "@/lib/ai";
import { toListingSummary } from "@/lib/api/listing-summary";
import { getEnrichedListings } from "@/lib/data/demo";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { matchSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:match:${ip}`, 20, 60_000);
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
    const parsed = matchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const matches = matchBusinesses(parsed.data, getEnrichedListings());
    const results = matches.map((m) => ({
      listing_id: m.listing_id,
      match_percent: m.match_percent,
      reasons: m.reasons,
      listing: toListingSummary(m.listing),
    }));

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error("[api/ai/match]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
