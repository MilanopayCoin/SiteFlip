import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { GIFT_CATALOG, getGift, supraToWei } from "@/lib/near/gifts";
import { isMoveAddress } from "@/lib/near/jiy-token";
import { consumeMoveTx, isMoveTxSpent } from "@/lib/near/spent-tx";
import {
  getProfile,
  listGiftInbox,
  listGiftLeaderboard,
  listGiftsFor,
  recordGift,
} from "@/lib/near/store";
import { verifyJiyGiftTransfer } from "@/lib/near/verify-jiy-tx";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    const sp = new URL(request.url).searchParams;
    const board = sp.get("board");
    const inbox = sp.get("inbox");
    if (board === "1" || board === "true") {
      if (!wallet) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const leaderboard = await listGiftLeaderboard(15);
      return Response.json({
        catalog: GIFT_CATALOG,
        leaderboard,
        boardPolicy: "move-mainnet-verified",
      });
    }
    if (inbox === "1" || inbox === "true") {
      if (!wallet) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const items = await listGiftInbox(wallet, 25);
      return Response.json({ catalog: GIFT_CATALOG, inbox: items });
    }
    if (!wallet) {
      return Response.json({ catalog: GIFT_CATALOG });
    }
    const ledger = await listGiftsFor(wallet);
    return Response.json({ catalog: GIFT_CATALOG, ledger });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gifts failed" },
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
    const body = (await request.json()) as {
      toWallet?: string;
      giftId?: string;
      txHash?: string | null;
      /** Client hint — server decides final mode after Move mainnet verify. */
      preferMode?: "jiy" | "ledger";
    };
    const gift = body.giftId ? getGift(body.giftId) : undefined;
    if (!gift || !body.toWallet || !/^0x[a-fA-F0-9]{40}$/.test(body.toWallet)) {
      return Response.json(
        { error: "toWallet + valid giftId required" },
        { status: 400 }
      );
    }
    if (body.toWallet.toLowerCase() === wallet) {
      return Response.json({ error: "Cannot gift yourself" }, { status: 400 });
    }

    const [fromProfile, toProfile] = await Promise.all([
      getProfile(wallet),
      getProfile(body.toWallet),
    ]);
    const fromMove = fromProfile?.moveAddress?.toLowerCase() || null;
    const toMove = toProfile?.moveAddress?.toLowerCase() || null;
    const rawTx = body.txHash?.trim() || null;

    let mode: "jiy" | "ledger" = "ledger";
    let txHash: string | null = null;

    if (fromMove && toMove && isMoveAddress(fromMove) && isMoveAddress(toMove)) {
      // Both linked → real Move mainnet FA required.
      if (!rawTx) {
        return Response.json(
          {
            error:
              "Her iki taraf Move bağlı — JIY mainnet transfer (txHash) zorunlu",
            code: "REQUIRE_MOVE_TX",
          },
          { status: 400 }
        );
      }
      if (await isMoveTxSpent(rawTx)) {
        return Response.json(
          { error: "Bu txHash zaten kullanıldı", code: "TX_REPLAY" },
          { status: 409 }
        );
      }
      const verified = await verifyJiyGiftTransfer({
        txHash: rawTx,
        fromMove: fromMove as string,
        toMove: toMove as string,
        amountJiy: gift.amountJiy,
      });
      txHash = await consumeMoveTx(verified.txHash, "gift");
      mode = "jiy";
    } else {
      // Peer (or self) missing Move → social ledger only; reject fake hashes.
      if (rawTx) {
        return Response.json(
          {
            error:
              "Peer Move adresi yok — sahte tx kabul edilmez; ledger hediye gönder",
            code: "LEDGER_ONLY",
          },
          { status: 400 }
        );
      }
      mode = "ledger";
      txHash = null;
    }

    const amountWei = supraToWei(gift.amountJiy);
    const rec = await recordGift({
      fromWallet: wallet,
      toWallet: body.toWallet,
      giftId: gift.id,
      amountWei,
      txHash,
      mode,
    });
    return Response.json({
      gift: rec,
      catalogItem: gift,
      mode,
      network: mode === "jiy" ? "supra-move-mainnet" : "ledger",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gift failed" },
      { status: 500 }
    );
  }
}
