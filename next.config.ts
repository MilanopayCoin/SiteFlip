import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // JIY.APP runs on Cloudflare Workers via OpenNext.
  // Worker service name remains "siteflip" for compatibility.
  async redirects() {
    return [
      {
        source: "/marketplace",
        destination: "/explore",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

// Enable Cloudflare bindings during local `next dev` when available.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
