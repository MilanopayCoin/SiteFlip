import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { GIFT_CATALOG, getGift, supraToWei } from "@/lib/near/gifts";
import { listGiftsFor, recordGift } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ catalog: GIFT_CATALOG });
  }
  const ledger = await listGiftsFor(wallet);
  return Response.json({ catalog: GIFT_CATALOG, ledger });
}

export async function POST(request: Request) {
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
  };
  const gift = body.giftId ? getGift(body.giftId) : undefined;
  if (!gift || !body.toWallet || !/^0x[a-fA-F0-9]{40}$/.test(body.toWallet)) {
    return Response.json({ error: "toWallet + valid giftId required" }, { status: 400 });
  }
  if (body.toWallet.toLowerCase() === wallet) {
    return Response.json({ error: "Cannot gift yourself" }, { status: 400 });
  }
  const amountWei = supraToWei(gift.amountSupra);
  const rec = await recordGift({
    fromWallet: wallet,
    toWallet: body.toWallet,
    giftId: gift.id,
    amountWei,
    txHash: body.txHash || null,
  });
  return Response.json({ gift: rec, catalogItem: gift });
}
