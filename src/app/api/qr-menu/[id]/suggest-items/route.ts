import { jsonError, jsonOk } from "@/lib/api/request-user";
import { suggestMenuItems, suggestRequestSchema } from "@/lib/qr-menu/suggest-items";
import { editorMenuView } from "@/lib/qr-menu/types";
import {
  getMenuById,
  updateQrMenu,
  verifyEditToken,
} from "@/lib/qr-menu/store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { parseMenuMarket } from "@/lib/places/markets";
import { nanoid } from "nanoid";
import type { MenuCategory } from "@/lib/qr-menu/types";

export const runtime = "nodejs";

function mergeCategories(existing: MenuCategory[], incoming: MenuCategory[]) {
  const base = [...existing];
  for (const cat of incoming) {
    const match = base.find(
      (c) => c.name.toLowerCase() === cat.name.toLowerCase()
    );
    if (match) {
      match.items.push(...cat.items);
    } else {
      base.push({ ...cat, id: nanoid(10) });
    }
  }
  return base.slice(0, 20);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;

  const body = suggestRequestSchema.safeParse(
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

  const existingNames = menu.categories.flatMap((c) =>
    c.items.map((i) => i.name)
  );
  const market = parseMenuMarket(menu.venue?.market);

  const suggestion = await suggestMenuItems({
    venueName: menu.name,
    tagline: menu.tagline || "",
    market,
    currency: menu.currency,
    count: body.data.count,
    existingNames,
  });

  const categories = mergeCategories(menu.categories, suggestion.categories);
  const updated = await updateQrMenu(id, body.data.editToken, { categories });
  if (!updated) return jsonError("Menu not found", 404);

  return jsonOk({
    menu: editorMenuView(updated),
    suggest: {
      provider: suggestion.provider,
      note: suggestion.note,
      added: suggestion.categories.reduce((n, c) => n + c.items.length, 0),
    },
  });
}
