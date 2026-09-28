import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/marketplace",
    "/sell",
    "/find",
    "/deals",
    "/login",
    "/signup",
    "/profile",
    "/privacy",
    "/terms",
    "/dashboard",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/marketplace" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/marketplace" ? 0.9 : 0.6,
  }));
}
