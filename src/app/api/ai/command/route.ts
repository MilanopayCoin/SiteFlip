import { NextResponse } from "next/server";
import { z } from "zod";
import { commandCenterReply } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const commandSchema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`ai:command:${ip}`, 10, 60_000);
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
    const parsed = commandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await commandCenterReply(
      parsed.data.prompt,
      parsed.data.context ?? {}
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/ai/command]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
