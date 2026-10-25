import { jsonError, jsonOk } from "@/lib/api/request-user";
import { safeFetchText } from "@/lib/http/safe-fetch";
import {
  draftToCategories,
  parseMenuFromHtml,
} from "@/lib/qr-menu/parse-menu-html";
import { importRequestSchema } from "@/lib/qr-menu/suggest-items";
import { editorMenuView } from "@/lib/qr-menu/types";
import {
  getMenuById,
  updateQrMenu,
  verifyEditToken,
} from "@/lib/qr-menu/store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { parseMenuMarket } from "@/lib/places/markets";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;

  const body = importRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  );
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

  let targetUrl = body.data.url?.trim();
  if (body.data.useVenueWebsite && menu.venue?.website) {
    targetUrl = menu.venue.website.startsWith("http")
      ? menu.venue.website
      : `https://${menu.venue.website}`;
  }
  if (!targetUrl) {
    return jsonError("Missing menu URL", 400);
  }

  try {
    const fetched = await safeFetchText(targetUrl);
    const market = parseMenuMarket(menu.venue?.market);
    const parsed = await parseMenuFromHtml({
      html: fetched.text,
      market,
      currency: menu.currency,
      venueName: menu.name,
    });

    if (!parsed.draft.categories.some((c) => c.items.length)) {
      return jsonError("No menu items found", 422, {
        method: parsed.method,
        warnings: parsed.warnings,
        fetchedUrl: fetched.url,
      });
    }

    const categories = draftToCategories(parsed.draft);
    const updated = await updateQrMenu(id, body.data.editToken, {
      categories,
    });
    if (!updated) return jsonError("Menu not found", 404);

    return jsonOk({
      menu: editorMenuView(updated),
      import: {
        method: parsed.method,
        warnings: parsed.warnings,
        fetchedUrl: fetched.url,
        itemCount: categories.reduce((n, c) => n + c.items.length, 0),
      },
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "IMPORT_FAILED";
    const status =
      code === "BLOCKED_HOST" || code === "INVALID_URL" ? 400 : 502;
    return jsonError("Import failed", status, { code });
  }
}
