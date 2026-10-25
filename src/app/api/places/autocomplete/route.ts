import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  autocompletePlaces,
  placesConfigured,
} from "@/lib/places/google";
import { menuMarketSchema } from "@/lib/qr-menu/types";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
  market: menuMarketSchema.default("nl"),
  sessionToken: z.string().trim().min(8).max(80),
});

export async function GET(request: Request) {
  await ensureCloudflareEnv();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    market: url.searchParams.get("market") ?? "nl",
    sessionToken: url.searchParams.get("sessionToken") ?? "",
  });

  if (!parsed.success) {
    return jsonError("Invalid query", 400, {
      details: parsed.error.flatten(),
    });
  }

  if (!placesConfigured()) {
    return jsonOk({
      configured: false,
      suggestions: [] as const,
      hint: "Set GOOGLE_PLACES_API_KEY for venue search.",
    });
  }

  const suggestions = await autocompletePlaces({
    query: parsed.data.q,
    market: parsed.data.market,
    sessionToken: parsed.data.sessionToken,
  });

  return jsonOk({ configured: true, suggestions });
}
