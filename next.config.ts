import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // JIY.APP runs on Cloudflare Workers via OpenNext.
  // Worker service name remains "siteflip" for compatibility.
  // Keep postgres external so OpenNext can apply the package "workerd"
  // export (postgres/cf → cloudflare:sockets). Bundling the Node build
  // causes write CONNECT_TIMEOUT from Workers to Supabase pooler/direct.
  serverExternalPackages: ["postgres"],
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
