import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import {
  editorMenuView,
  publicMenuView,
  updateMenuSchema,
} from "@/lib/qr-menu/types";
import {
  getMenuById,
  updateQrMenu,
  verifyEditToken,
} from "@/lib/qr-menu/store";

export const runtime = "nodejs";

/** GET menu for editor when ?token= matches; otherwise public fields only if published. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");

  const menu = await getMenuById(id);
  if (!menu) return jsonError("Menu not found", 404);

  if (verifyEditToken(menu, token)) {
    return jsonOk({
      menu: editorMenuView(menu),
      publicPath: `/m/${menu.slug}`,
      canEdit: true,
    });
  }

  if (!menu.published) return jsonError("Menu not found", 404);
  return jsonOk({
    menu: publicMenuView(menu),
    publicPath: `/m/${menu.slug}`,
    canEdit: false,
  });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;

  const parsed = updateMenuSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const { editToken, ...patch } = parsed.data;
    const updated = await updateQrMenu(id, editToken, {
      name: patch.name,
      tagline: patch.tagline,
      currency: patch.currency,
      locale: patch.locale,
      accentColor: patch.accentColor,
      logoUrl: patch.logoUrl,
      special: patch.special,
      categories: patch.categories,
      published: patch.published,
    });
    if (!updated) return jsonError("Menu not found", 404);
    return jsonOk({
      menu: editorMenuView(updated),
      publicPath: `/m/${updated.slug}`,
      saved: true,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return jsonError("Invalid edit token", 403);
    }
    console.error("qr-menu update failed", err);
    return jsonError("Failed to update menu", 500);
  }
}
