/** Public site origin for sitemaps and absolute URLs (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://jiy.app";
