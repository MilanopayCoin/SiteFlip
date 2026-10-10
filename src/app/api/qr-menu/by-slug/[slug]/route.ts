import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { publicMenuView } from "@/lib/qr-menu/types";
import { getMenuBySlug } from "@/lib/qr-menu/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  await ensureCloudflareEnv();
  const { slug } = await ctx.params;
  const menu = await getMenuBySlug(slug);
  if (!menu || !menu.published) return jsonError("Menu not found", 404);
  return jsonOk({ menu: publicMenuView(menu) });
}
