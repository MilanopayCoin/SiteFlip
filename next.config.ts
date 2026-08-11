import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SITEFLIP runs on Cloudflare Workers via OpenNext.
};

export default nextConfig;

// Enable Cloudflare bindings during local `next dev` when available.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
