import type { RuntimeLogFields } from "./types";

/** Structured runtime log — never include secrets. */
export function logGeneratedRuntime(fields: RuntimeLogFields): void {
  console.log(
    JSON.stringify({
      scope: "jiy.generated_runtime",
      projectId: fields.projectId,
      buildId: fields.buildId,
      artifactId: fields.artifactId,
      runtimeStage: fields.runtimeStage,
      httpStatus: fields.httpStatus,
      page: fields.page ?? null,
      error: fields.error ? String(fields.error).slice(0, 240) : null,
      at: new Date().toISOString(),
    })
  );
}
