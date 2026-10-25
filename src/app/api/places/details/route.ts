import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { enrichFromGooglePlace } from "@/lib/places/enrich";
import { placePhotoProxyPath, placesConfigured } from "@/lib/places/google";
import { menuMarketSchema } from "@/lib/qr-menu/types";

export const runtime = "nodejs";

const querySchema = z.object({
  placeId: z.string().trim().min(4).max(120),
  market: menuMarketSchema.default("nl"),
  sessionToken: z.string().trim().min(8).max(80),
});

export async function GET(request: Request) {
  await ensureCloudflareEnv();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    placeId: url.searchParams.get("placeId") ?? "",
    market: url.searchParams.get("market") ?? "nl",
    sessionToken: url.searchParams.get("sessionToken") ?? "",
  });

  if (!parsed.success) {
    return jsonError("Invalid query", 400, {
      details: parsed.error.flatten(),
    });
  }

  if (!placesConfigured()) {
    return jsonError("Google Places not configured", 503);
  }

  const result = await enrichFromGooglePlace(parsed.data);
  if (!result.ok) {
    return jsonError("Place not found", 404);
  }

  const photoUrl = result.data.venue.photoName
    ? placePhotoProxyPath(result.data.venue.photoName)
    : null;

  return jsonOk({
    ...result.data,
    photoUrl,
  });
}
