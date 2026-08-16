import { NextResponse } from "next/server";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { getAiConfigStatus, aiChat } from "@/lib/ai/providers";
import { isMollieConfigured, isMollieTestMode } from "@/lib/payments/mollie";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const runtime = "nodejs";

/**
 * Public integrations health — never returns secret values.
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const url = new URL(request.url);
  const pingAi = url.searchParams.get("pingAi") === "1";

  const ai = getAiConfigStatus();
  let aiPing: { ok: boolean; provider?: string; model?: string } | null = null;

  if (pingAi && ai.primary !== "heuristic") {
    try {
      const result = await aiChat(
        "You are JIY.APP health check. Reply with JSON {\"ok\":true}. Do not invent data.",
        "ping",
        { json: true }
      );
      aiPing = {
        ok: Boolean(result.content),
        provider: result.provider,
        model: result.model,
      };
    } catch {
      aiPing = { ok: false, provider: ai.primary };
    }
  }

  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    ai: {
      primary: ai.primary,
      providers: {
        groq: ai.groq,
        openai: ai.openai,
        gemini: ai.gemini,
        ollama: ai.ollama,
      },
      ping: aiPing,
    },
    mollie: {
      configured: isMollieConfigured(),
      testMode: isMollieConfigured() ? isMollieTestMode() : null,
      isEscrow: false,
      endpoints: {
        create: "/api/payments/mollie/create",
        webhook: "/api/payments/mollie/webhook",
      },
    },
  });
}
