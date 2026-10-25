import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { buildTablePrintPackPdf } from "@/lib/qr-menu/print-pack";
import { getMenuById, verifyEditToken } from "@/lib/qr-menu/store";

export const runtime = "nodejs";

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://siteflip.miqomilano.workers.dev"
  ).replace(/\/$/, "");
}

/**
 * A4 PDF with table QR cards for print shops.
 * Requires edit token (owner-only).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const tables = Math.min(
    40,
    Math.max(1, Number(url.searchParams.get("tables") || 6) || 6)
  );

  const menu = await getMenuById(id);
  if (!menu) {
    return Response.json({ error: "Menu not found" }, { status: 404 });
  }
  if (!verifyEditToken(menu, token)) {
    return Response.json({ error: "Invalid edit token" }, { status: 403 });
  }

  const bytes = await buildTablePrintPackPdf({
    venueName: menu.name,
    slug: menu.slug,
    baseUrl: appBase(),
    tableCount: tables,
  });

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="jiy-menu-${menu.slug}-masalar.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
