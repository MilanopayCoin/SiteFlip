import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { buildMenuQrSvg } from "@/lib/qr-menu/qr";
import { getMenuById } from "@/lib/qr-menu/store";

export const runtime = "nodejs";

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://siteflip.miqomilano.workers.dev"
  ).replace(/\/$/, "");
}

/** SVG QR pointing at the public menu URL. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const menu = await getMenuById(id);
  if (!menu || !menu.published) {
    return Response.json({ error: "Menu not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const size = Math.min(
    1024,
    Math.max(128, Number(url.searchParams.get("size") || 512) || 512)
  );
  const target = `${appBase()}/m/${menu.slug}`;
  const svg = await buildMenuQrSvg(target, size);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `inline; filename="jiy-menu-${menu.slug}.svg"`,
    },
  });
}
