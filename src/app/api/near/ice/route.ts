import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { buildNearIcePayload } from "@/lib/near/ice";

export const runtime = "nodejs";

/**
 * Authenticated ICE config for voice / video / roulette mesh.
 * TURN credentials stay server-side (JIY_NEAR_TURN_*).
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = buildNearIcePayload();
  return Response.json(payload, {
    headers: {
      "cache-control": "private, max-age=60",
    },
  });
}
