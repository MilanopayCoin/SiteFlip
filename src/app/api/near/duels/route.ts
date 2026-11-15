import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  acceptDuel,
  challengeDuel,
  declineDuel,
  DUEL_SECONDS,
  getDuel,
  listDuelsFor,
} from "@/lib/near/duels";
import { isMutualWave } from "@/lib/near/waves";

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
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const duel = await getDuel(id);
      if (!duel) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      if (duel.aWallet !== wallet && duel.bWallet !== wallet) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      return Response.json({ duel, duelSeconds: DUEL_SECONDS });
    }
    const duels = await listDuelsFor(wallet);
    return Response.json({ duels, duelSeconds: DUEL_SECONDS });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Duels failed" },
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
      peerWallet?: string;
      duelId?: string;
      action?: "accept" | "decline" | "challenge";
    };

    if (body.peerWallet && (!body.action || body.action === "challenge")) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(body.peerWallet)) {
        return Response.json({ error: "Invalid peer" }, { status: 400 });
      }
      if (!(await isMutualWave(wallet, body.peerWallet))) {
        return Response.json(
          {
            error: "Düello için karşılıklı Selam gerekli",
            code: "MUTUAL_WAVE_REQUIRED",
          },
          { status: 403 }
        );
      }
      const duel = await challengeDuel(wallet, body.peerWallet);
      return Response.json({ duel, duelSeconds: DUEL_SECONDS });
    }

    if (body.duelId && body.action === "accept") {
      const duel = await acceptDuel(body.duelId, wallet);
      return Response.json({ duel, duelSeconds: DUEL_SECONDS });
    }

    if (body.duelId && body.action === "decline") {
      const duel = await declineDuel(body.duelId, wallet);
      return Response.json({ duel, duelSeconds: DUEL_SECONDS });
    }

    return Response.json({ error: "Invalid body" }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Duel action failed" },
      { status: 500 }
    );
  }
}
