import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { editorMenuView } from "@/lib/qr-menu/types";
import {
  getMenuById,
  updateQrMenu,
  verifyEditToken,
} from "@/lib/qr-menu/store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { parseMenuMarket } from "@/lib/places/markets";
import { enrichTrustpilotByWebsite } from "@/lib/trustpilot/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  editToken: z.string().min(8).max(80),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return jsonError("Validation failed", 400, {
      details: body.error.flatten(),
    });
  }

  const menu = await getMenuById(id);
  if (!menu) return jsonError("Menu not found", 404);
  if (!verifyEditToken(menu, body.data.editToken)) {
    return jsonError("Invalid edit token", 403);
  }

  const venue = menu.venue;
  if (!venue?.website) {
    return jsonError("No website on venue", 400);
  }

  const market = parseMenuMarket(venue.market);
  const tp = await enrichTrustpilotByWebsite({
    website: venue.website,
    businessName: menu.name,
    market,
  });

  const updatedVenue = {
    ...venue,
    trustpilotProfileUrl: tp.profileUrl ?? venue.trustpilotProfileUrl,
    trustpilotScore: tp.trustScore ?? venue.trustpilotScore,
    trustpilotReviewCount: tp.reviewCount ?? venue.trustpilotReviewCount,
    enrichedAt: new Date().toISOString(),
  };

  const updated = await updateQrMenu(id, body.data.editToken, {
    venue: updatedVenue,
  });
  if (!updated) return jsonError("Menu not found", 404);

  return jsonOk({
    menu: editorMenuView(updated),
    trustpilot: tp,
  });
}
