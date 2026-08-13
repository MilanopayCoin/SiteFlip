/**
 * Request-scoped AI runtime overrides.
 * Prefer this over mutating process.env (unreliable on Cloudflare Workers).
 */

export type AiRuntimeOverride = {
  forceHeuristic?: boolean;
};

const g = globalThis as unknown as {
  __jiyAiRuntime?: AiRuntimeOverride;
};

export function getAiRuntimeOverride(): AiRuntimeOverride {
  return g.__jiyAiRuntime ?? {};
}

export function withAiRuntimeOverride<T>(
  override: AiRuntimeOverride,
  fn: () => Promise<T>
): Promise<T> {
  const prev = g.__jiyAiRuntime;
  g.__jiyAiRuntime = { ...prev, ...override };
  return fn().finally(() => {
    g.__jiyAiRuntime = prev;
  });
}
