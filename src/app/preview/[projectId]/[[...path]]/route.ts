import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; path?: string[] }> };

/**
 * Legacy /preview/:projectId runtime — durable apps live at /generated/:id.
 * Keep this redirect so old links and bookmarks still open.
 */
export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const url = new URL(request.url);
  const target = new URL(`/generated/${projectId}`, url.origin);
  target.search = url.search;
  return NextResponse.redirect(target, 307);
}
