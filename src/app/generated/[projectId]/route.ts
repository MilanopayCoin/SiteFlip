import { serveGeneratedApp } from "@/lib/factory/generated-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const url = new URL(request.url);
  const pageRaw = url.searchParams.get("p") || url.searchParams.get("page");
  return serveGeneratedApp({
    projectId,
    pageRaw,
    requestUrl: request.url,
  });
}
