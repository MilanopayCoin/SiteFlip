/**
 * Client-side cache for LOCAL factory projects.
 * Cloudflare Worker isolates do not share in-memory Map state.
 */

import type { FactoryProject } from "./types";

const KEY = "siteflip_factory_projects_v2";

function readAll(): Record<string, FactoryProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      sessionStorage.getItem(KEY) ||
      sessionStorage.getItem("siteflip_factory_projects_v1") ||
      "{}";
    const map = JSON.parse(raw) as Record<string, FactoryProject>;
    for (const p of Object.values(map)) {
      if (!p.pipelineVersion) p.pipelineVersion = "v2";
      if (!p.usage.aiRequestCount) p.usage.aiRequestCount = 0;
      if (!p.usage.buildAttempts) p.usage.buildAttempts = 0;
    }
    return map;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, FactoryProject>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(map));
}

export function cacheFactoryProject(project: FactoryProject) {
  const all = readAll();
  all[project.id] = project;
  writeAll(all);
}

export function readCachedFactoryProject(
  id: string
): FactoryProject | null {
  return readAll()[id] ?? null;
}

export function listCachedFactoryProjects(): FactoryProject[] {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
