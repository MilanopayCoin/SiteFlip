import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { getGift } from "@/lib/near/gifts";
import {
  contributeToPot,
  drawPotWinner,
  getPot,
  lastDraw,
  recentPotEvents,
} from "@/lib/near/pots";
import { getPresence } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
      pot: null,
      events: [],
      hint: "Check-in required for place pot",
    });
  }
  const pot = await getPot(presence.geohash);
  const events = await recentPotEvents(presence.geohash);
  const draw = lastDraw(presence.geohash);
  return Response.json({ pot, events, geohash: presence.geohash, draw });
}

export async function POST(request: Request) {
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
  const body = (await request.json()) as {
    giftId?: string;
    txHash?: string | null;
    action?: "contribute" | "draw";
  };

  if (body.action === "draw") {
    try {
      const draw = await drawPotWinner(presence.geohash);
      return Response.json({ draw });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Draw failed" },
        { status: 400 }
      );
    }
  }

  if (!body.giftId || !getGift(body.giftId)) {
    return Response.json({ error: "Valid giftId required" }, { status: 400 });
  }
  const pot = await contributeToPot({
    geohash: presence.geohash,
    fromWallet: wallet,
    giftId: body.giftId,
    txHash: body.txHash || null,
  });
  return Response.json({ pot });
}
