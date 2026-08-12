import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// R2 incremental cache can be enabled later with a NEXT_INC_CACHE_R2_BUCKET binding.
const config = defineCloudflareConfig({});

// Ensure esbuild resolves postgres via package.json "workerd" condition
// (Cloudflare sockets build) instead of the Node net build.
config.cloudflare = {
  ...(config.cloudflare || {}),
  useWorkerdCondition: true,
};

export default config;
