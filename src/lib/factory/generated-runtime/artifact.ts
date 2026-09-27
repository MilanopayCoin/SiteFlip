import { nanoid } from "nanoid";
import type { FactoryProject } from "../types";
import type { PlanSpec, ProductSpec } from "../schemas";
import { getOutputByAgent } from "../store";
import {
  MVP_PAGES,
  type GeneratedRuntimeArtifact,
  type MvpPageId,
} from "./types";

export function generatedPathFor(projectId: string, page?: string): string {
  const base = `/generated/${projectId}`;
  if (!page || page === "landing") return base;
  return `${base}?p=${encodeURIComponent(page)}`;
}

export function normalizeMvpPage(raw: string | null | undefined): MvpPageId {
  const v = (raw || "landing").toLowerCase().trim();
  if ((MVP_PAGES as readonly string[]).includes(v)) return v as MvpPageId;
  return "landing";
}

export function createRuntimeArtifact(
  project: FactoryProject,
  opts?: { buildId?: string; version?: string }
): GeneratedRuntimeArtifact {
  const plan = getOutputByAgent(project, "PlannerAgent")?.data as
    | PlanSpec
    | undefined;
  const product = getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;
  const appName =
    plan?.businessName ||
    project.name ||
    "Generated App";
  const buildId = opts?.buildId || `build_${nanoid(10)}`;
  const artifactId = `art_${nanoid(12)}`;
  const version = opts?.version || "1";

  const fromPlan = (product?.pages?.length ? product.pages : plan?.mvpPages) || [];
  const pages = [
    ...MVP_PAGES,
    ...fromPlan.map((p) => p.toLowerCase().replace(/\s+/g, "_")),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    projectId: project.id,
    businessId: project.sandbox.businessId || project.id,
    version,
    buildId,
    artifactId,
    entrypoint: generatedPathFor(project.id),
    runtimeKind: "platform_html_mvp",
    pages,
    appName,
    createdAt: new Date().toISOString(),
  };
}

/** Attach / refresh durable runtime artifact on the project sandbox. */
export function ensureRuntimeArtifact(
  project: FactoryProject,
  opts?: { buildId?: string; version?: string; force?: boolean }
): GeneratedRuntimeArtifact {
  const existing = project.sandbox.runtimeArtifact;
  if (existing && !opts?.force) {
    existing.entrypoint = generatedPathFor(project.id);
    project.sandbox.previewUrl = existing.entrypoint;
    return existing;
  }
  const artifact = createRuntimeArtifact(project, opts);
  project.sandbox.runtimeArtifact = artifact;
  project.sandbox.previewUrl = artifact.entrypoint;
  project.sandbox.buildLogs = [
    ...(project.sandbox.buildLogs || []),
    `Runtime artifact ${artifact.artifactId} · build ${artifact.buildId}`,
    `Entrypoint ${artifact.entrypoint}`,
  ].slice(-40);
  return artifact;
}
