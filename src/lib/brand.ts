/**
 * JIY.APP brand constants.
 * User-facing product name is JIY.APP.
 * Internal legacy identifiers (env vars, worker names, DB) may still
 * reference "siteflip" for backward compatibility — do not rename those.
 */

export const BRAND = {
  name: "JIY",
  fullName: "JIY.APP",
  domain: "jiy.app",
  url: "https://jiy.app",
  tagline: "Turn ideas into businesses.",
  positioning: "AI Business Factory",
  lifecycle: ["BUILD", "GROW", "BUY", "RENT", "REVIVE", "SELL"] as const,
  /** Legacy internal product id — keep for env / worker compatibility */
  legacyInternalId: "siteflip",
} as const;

export function brandLabel(legacy?: string | null): string {
  if (!legacy) return BRAND.fullName;
  const lower = legacy.toLowerCase();
  if (lower.includes("siteflip") || lower === "site flip") return BRAND.fullName;
  return legacy;
}

/** Replace user-facing SITEFLIP strings in display copy (not code identifiers) */
export function toUserFacingCopy(text: string): string {
  return text
    .replace(/SITEFLIP/g, BRAND.fullName)
    .replace(/SiteFlip/g, BRAND.fullName)
    .replace(/siteflip/gi, (m) =>
      m === "siteflip" ? "jiy.app" : BRAND.fullName
    );
}
