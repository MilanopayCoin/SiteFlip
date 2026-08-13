import { NextResponse } from "next/server";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { getFactoryProject } from "@/lib/factory/store";
import { loadFactoryProject } from "@/lib/factory/supabase-store";
import {
  attachGeneratedAppArtifact,
  getGeneratedAppArtifact,
  hasApplicationEntrypoint,
  renderGeneratedAppErrorHtml,
  renderGeneratedAppHtml,
  renderProjectNotFoundHtml,
  type GeneratedAppErrorStage,
} from "@/lib/factory/generated-app-runtime";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; path?: string[] }> };

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(_request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { projectId, path } = await ctx.params;

  try {
    const loaded = await loadFactoryProject(projectId, { preferDatabase: true });
    const project = loaded.project ?? getFactoryProject(projectId) ?? null;
    if (!project) {
      return htmlResponse(renderProjectNotFoundHtml(projectId), 404);
    }

    let artifact = getGeneratedAppArtifact(project);
    if (!hasApplicationEntrypoint(artifact)) {
      try {
        artifact = attachGeneratedAppArtifact(project);
      } catch (error) {
        return htmlResponse(
          renderGeneratedAppErrorHtml({
            stage: "artifact",
            message:
              error instanceof Error
                ? error.message
                : "Generated application artifact is missing.",
            projectId,
            buildId: artifact?.buildId ?? null,
          }),
          503
        );
      }
    }

    const { html } = renderGeneratedAppHtml(project, path || []);
    return htmlResponse(html, 200);
  } catch (error) {
    const stage =
      (error as { stage?: GeneratedAppErrorStage }).stage || "html_render";
    return htmlResponse(
      renderGeneratedAppErrorHtml({
        stage,
        message:
          error instanceof Error ? error.message : "Generated app runtime failed",
        projectId,
        buildId: null,
      }),
      503
    );
  }
}
