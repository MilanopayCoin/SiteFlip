import { NextResponse } from "next/server";
import { generateBusinessBlueprint } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { buildWizardSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:build:${ip}`, 20, 60_000);
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
    const parsed = buildWizardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await generateBusinessBlueprint(parsed.data);
    return NextResponse.json({
      blueprint: result.blueprint,
      assumptions: result.assumptions,
      source: result.source,
    });
  } catch (error) {
    console.error("[api/ai/build]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
