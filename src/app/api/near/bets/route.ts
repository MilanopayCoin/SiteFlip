import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { isMoveAddress } from "@/lib/near/jiy-token";
import {
  commitMatchBet,
  getMatchBalances,
  listMatchBets,
  prepareMatchBet,
  settleOpenBets,
  type BetCurrency,
  type BetPick,
} from "@/lib/near/match-bets";
import { fetchMatchOdds } from "@/lib/near/odds";
import { consumeMoveTx, isMoveTxSpent } from "@/lib/near/spent-tx";
import { getProfile } from "@/lib/near/store";
import { verifyJiyGiftTransfer } from "@/lib/near/verify-jiy-tx";

export const runtime = "nodejs";

function betTreasury(): string | null {
  const addr = (
    process.env.NEXT_PUBLIC_JIY_NEAR_BET_MOVE_ADDRESS ||
    process.env.NEXT_PUBLIC_JIY_NEAR_POT_MOVE_ADDRESS ||
    ""
  )
    .trim()
    .toLowerCase();
  return isMoveAddress(addr) ? addr : null;
}

export async function GET(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    const sp = new URL(request.url).searchParams;
    const limit = Math.min(Number(sp.get("limit") || 40) || 40, 80);

    const odds = await fetchMatchOdds(limit);
    if (!wallet) {
      return Response.json({
        matches: odds.matches,
        attribution: odds.attribution,
        fetchedAt: odds.fetchedAt,
        cached: odds.cached,
      });
    }

    if (sp.get("settle") === "1") {
      await settleOpenBets(wallet);
    }

    const [balances, myBets] = await Promise.all([
      getMatchBalances(wallet),
      listMatchBets(wallet, 50),
    ]);

    return Response.json({
      matches: odds.matches,
      attribution: odds.attribution,
      fetchedAt: odds.fetchedAt,
      cached: odds.cached,
      balances,
      bets: myBets,
      treasuryMove: betTreasury(),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Bets failed" },
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
      action?: "place" | "settle";
      matchId?: string;
      pick?: BetPick;
      stake?: number;
      currency?: BetCurrency;
      txHash?: string | null;
    };

    if (body.action === "settle") {
      const result = await settleOpenBets(wallet);
      return Response.json(result);
    }

    if (
      !body.matchId ||
      !body.pick ||
      !body.currency ||
      typeof body.stake !== "number"
    ) {
      return Response.json(
        { error: "matchId + pick + stake + currency required" },
        { status: 400 }
      );
    }

    // Validate match/pick/stake/kickoff BEFORE irreversible Move spend.
    const prepared = await prepareMatchBet({
      wallet,
      matchId: body.matchId,
      pick: body.pick,
      stake: body.stake,
      currency: body.currency,
    });

    let txHash: string | null = null;
    if (prepared.currency === "jiy") {
      const treasury = betTreasury();
      const rawTx = body.txHash?.trim() || null;
      if (treasury) {
        if (!rawTx) {
          return Response.json(
            {
              error: "JIY bahis için Move mainnet txHash zorunlu",
              code: "REQUIRE_MOVE_TX",
              treasuryMove: treasury,
            },
            { status: 400 }
          );
        }
        const profile = await getProfile(wallet);
        const fromMove = profile?.moveAddress?.toLowerCase() || "";
        if (!isMoveAddress(fromMove)) {
          return Response.json(
            { error: "Önce profilde Move bağla", code: "LINK_MOVE" },
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
          fromMove,
          toMove: treasury,
          amountJiy: prepared.stake,
        });
        // Claim spend only after prepare succeeded (match still open, stake ok).
        txHash = await consumeMoveTx(verified.txHash, "bet");
      }
    }

    // persistBet throws on DB errors; ledger debits refund on persist failure.
    const placed = await commitMatchBet(prepared, txHash);
    return Response.json({
      ...placed,
      network:
        prepared.currency === "jiy"
          ? txHash
            ? "supra-move-mainnet"
            : "jiy-ledger"
          : "supra-ledger",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bet failed";
    const status =
      msg.includes("bulunamadı") ||
      msg.includes("kapalı") ||
      msg.includes("Geçersiz") ||
      msg.includes("Max ") ||
      msg.includes("Yetersiz")
        ? 400
        : 500;
    return Response.json({ error: msg }, { status });
  }
}
