/**
 * Cloudflare Worker entry for JIY.APP / siteflip.
 * Intercepts /api/admin/migrate before OpenNext when possible.
 */
import openNextWorker from "./.open-next/worker.js";
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/admin/migrate") {
        const { handleAdminMigrate } = await import("./src/lib/db/migrate-entry.ts");
        return handleAdminMigrate(request, env);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "migrate_entry_failed";
      return new Response(
        JSON.stringify({
          ok: false,
          connected: false,
          error: message.slice(0, 300),
          entry: "thin-worker",
        }),
        { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    return openNextWorker.fetch(request, env, ctx);
  },
};
