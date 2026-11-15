import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { buildNearIcePayload } from "@/lib/near/ice";

export const runtime = "nodejs";

/**
 * Authenticated ICE config for voice / video / roulette mesh.
 * Ephemeral TURN via coturn REST (JIY_NEAR_TURN_SECRET) — no static password leak.
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildNearIcePayload(wallet);
  return Response.json(payload, {
    headers: {
      "cache-control": "private, max-age=30",
    },
  });
}
