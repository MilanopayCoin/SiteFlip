import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { listClaims, myClaim } from "@/lib/near/claims";
import { listRoomMessages, postRoomMessage } from "@/lib/near/rooms";
import { getPresence } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const presence = await getPresence(wallet);
    if (!presence) {
      return Response.json({
        messages: [],
        geohash: null,
        claims: [],
        mineClaim: null,
        hint: "Check-in required for place room",
      });
    }
    const [messages, claims, mineClaim] = await Promise.all([
      listRoomMessages(presence.geohash),
      listClaims(presence.geohash),
      myClaim(wallet),
    ]);
    return Response.json({
      messages,
      geohash: presence.geohash.slice(0, 5),
      claims,
      mineClaim,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Room load failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const presence = await getPresence(wallet);
    if (!presence) {
      return Response.json({ error: "Check-in required" }, { status: 400 });
    }
    const body = (await request.json()) as { text?: string };
    if (!body.text?.trim()) {
      return Response.json({ error: "text required" }, { status: 400 });
    }
    const message = await postRoomMessage({
      geohash: presence.geohash,
      fromWallet: wallet,
      body: body.text,
    });
    return Response.json({ message });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Room post failed" },
      { status: 500 }
    );
  }
}
