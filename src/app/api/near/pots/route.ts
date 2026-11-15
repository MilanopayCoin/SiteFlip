import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { getGift } from "@/lib/near/gifts";
import { isMoveAddress, unitsToJiy } from "@/lib/near/jiy-token";
import {
  contributeToPot,
  drawPotWinner,
  getPot,
  lastDraw,
  recentPotEvents,
} from "@/lib/near/pots";
import { getPresence, getProfile } from "@/lib/near/store";
import { verifyJiyGiftTransfer } from "@/lib/near/verify-jiy-tx";

function potPayload(pot: Awaited<ReturnType<typeof getPot>>) {
  return {
    ...pot,
    totalJiy: unitsToJiy(pot.totalWei),
  };
}

function potMoveTreasury(): string | null {
  const addr = (process.env.NEXT_PUBLIC_JIY_NEAR_POT_MOVE_ADDRESS || "")
    .trim()
    .toLowerCase();
  return isMoveAddress(addr) ? addr : null;
}

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
  const treasury = potMoveTreasury();
  return Response.json({
    pot: potPayload(pot),
    events,
    geohash: presence.geohash,
    draw,
    treasuryMode: treasury ? "move-mainnet" : "ledger",
    treasuryMove: treasury,
  });
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

  const gift = body.giftId ? getGift(body.giftId) : undefined;
  if (!gift) {
    return Response.json({ error: "Valid giftId required" }, { status: 400 });
  }

  const treasury = potMoveTreasury();
  const rawTx = body.txHash?.trim() || null;
  let txHash: string | null = null;
  let mode: "jiy" | "ledger" | "evm" = "ledger";

  if (treasury) {
    if (!rawTx) {
      return Response.json(
        {
          error: "Move kasa aktif — JIY mainnet txHash zorunlu",
          code: "REQUIRE_MOVE_TX",
        },
        { status: 400 }
      );
    }
    const profile = await getProfile(wallet);
    const fromMove = profile?.moveAddress?.toLowerCase() || "";
    if (!isMoveAddress(fromMove)) {
      return Response.json(
        {
          error: "Önce profilde Move adresini bağla",
          code: "LINK_MOVE",
        },
        { status: 400 }
      );
    }
    const verified = await verifyJiyGiftTransfer({
      txHash: rawTx,
      fromMove,
      toMove: treasury,
      amountJiy: gift.amountJiy,
    });
    txHash = verified.txHash;
    mode = "jiy";
  } else if (rawTx) {
    // No Move treasury configured — accept EVM/legacy hash as opaque proof only
    // (not Move-verified). Prefer ledger-only when unset.
    txHash = rawTx;
    mode = "evm";
  }

  const pot = await contributeToPot({
    geohash: presence.geohash,
    fromWallet: wallet,
    giftId: gift.id,
    txHash,
  });
  return Response.json({ pot: potPayload(pot), mode, network: mode });
}
