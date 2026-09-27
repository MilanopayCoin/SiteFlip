import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { resolveFactoryProject } from "../supabase-store";
import { getFactoryProject } from "../store";
import {
  ensureRuntimeArtifact,
  generatedPathFor,
  normalizeMvpPage,
} from "./artifact";
import { renderGeneratedAppErrorHtml, renderGeneratedAppHtml } from "./html";
import { logGeneratedRuntime } from "./log";
import {
  GENERATED_APP_MARKER,
  type GeneratedRuntimeArtifact,
} from "./types";

const READY_STATES = new Set([
  "PREVIEW",
  "APPROVAL_REQUIRED",
  "DEPLOYING",
  "LIVE",
  "READY",
]);

export async function serveGeneratedApp(input: {
  projectId: string;
  pageRaw?: string | null;
  requestUrl?: string;
}): Promise<Response> {
  await ensureCloudflareEnv();
  const projectId = input.projectId;
  const page = normalizeMvpPage(input.pageRaw);
  const retryHref = generatedPathFor(projectId, page);

  let runtimeStage: Parameters<typeof logGeneratedRuntime>[0]["runtimeStage"] =
    "resolve_project";
  let buildId: string | null = null;
  let artifactId: string | null = null;

  try {
    const project =
      (await resolveFactoryProject(projectId)) ??
      getFactoryProject(projectId) ??
      null;

    if (!project) {
      logGeneratedRuntime({
        projectId,
        buildId,
        artifactId,
        runtimeStage,
        httpStatus: 404,
        page,
        error: "Project not found",
      });
      return htmlResponse(
        renderGeneratedAppErrorHtml({
          projectId,
          buildId,
          artifactId,
          runtimeStage,
          error: "Project not found in Supabase or isolate memory",
          retryHref,
        }),
        404
      );
    }

    runtimeStage = "load_artifact";
    let artifact: GeneratedRuntimeArtifact | null =
      project.sandbox.runtimeArtifact ?? null;

    const hasCode = project.outputs.some((o) => o.agent === "DeveloperAgent");
    const readyEnough =
      READY_STATES.has(project.state) ||
      project.sandbox.deploymentStatus === "READY" ||
      project.sandbox.deploymentStatus === "LIVE" ||
      Boolean(artifact) ||
      hasCode;

    if (!readyEnough) {
      logGeneratedRuntime({
        projectId,
        buildId,
        artifactId,
        runtimeStage,
        httpStatus: 409,
        page,
        error: `Project state ${project.state} not ready for runtime`,
      });
      return htmlResponse(
        renderGeneratedAppErrorHtml({
          projectId,
          buildId,
          artifactId,
          runtimeStage,
          error: `Generated app not ready (state=${project.state}). Finish BUILD → PREVIEW first.`,
          retryHref,
        }),
        409
      );
    }

    if (!artifact) {
      // Recover durable metadata from BUILD outputs so refresh/new session still works.
      artifact = ensureRuntimeArtifact(project);
    }

    buildId = artifact.buildId;
    artifactId = artifact.artifactId;

    runtimeStage = "render_app";
    const html = renderGeneratedAppHtml({ project, artifact, page });
    if (!html.includes(GENERATED_APP_MARKER)) {
      throw new Error("Renderer did not emit generated-app marker");
    }

    logGeneratedRuntime({
      projectId,
      buildId,
      artifactId,
      runtimeStage,
      httpStatus: 200,
      page,
    });

    return htmlResponse(html, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Runtime failure";
    logGeneratedRuntime({
      projectId,
      buildId,
      artifactId,
      runtimeStage: "error",
      httpStatus: 500,
      page,
      error: message,
    });
    return htmlResponse(
      renderGeneratedAppErrorHtml({
        projectId,
        buildId,
        artifactId,
        runtimeStage: "error",
        error: message,
        retryHref,
      }),
      500
    );
  }
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-jiy-generated-runtime": status === 200 ? "ok" : "error",
    },
  });
}

/** Absolute HTTP verify used by LIVE publish — must see real HTML. */
export async function verifyGeneratedAppHttp(
  projectId: string,
  baseUrl: string
): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}${generatedPathFor(projectId)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    });
    const body = await res.text();
    const hasMarker = body.includes(GENERATED_APP_MARKER);
    const ok = res.status === 200 && hasMarker;
    logGeneratedRuntime({
      projectId,
      buildId: null,
      artifactId: null,
      runtimeStage: "verify_http",
      httpStatus: res.status,
      error: ok ? undefined : hasMarker ? `HTTP ${res.status}` : "missing marker",
    });
    return {
      ok,
      status: res.status,
      detail: ok
        ? `HTTP 200 + marker at ${url}`
        : `Verify failed HTTP ${res.status} marker=${hasMarker} url=${url}`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "verify fetch failed";
    logGeneratedRuntime({
      projectId,
      buildId: null,
      artifactId: null,
      runtimeStage: "verify_http",
      httpStatus: 0,
      error: detail,
    });
    return { ok: false, status: 0, detail };
  }
}
