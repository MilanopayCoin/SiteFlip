import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  isMutualWave,
  listWaveSummary,
  recordWave,
} from "@/lib/near/waves";

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
    const peer = new URL(request.url).searchParams.get("peer");
    if (peer && /^0x[a-fA-F0-9]{40}$/.test(peer)) {
      const summary = await listWaveSummary(wallet);
      const p = peer.toLowerCase();
      return Response.json({
        peer: p,
        iWaved: summary.outgoing.includes(p),
        theyWaved: summary.incoming.includes(p),
        mutual: await isMutualWave(wallet, p),
        summary,
      });
    }
    const summary = await listWaveSummary(wallet);
    return Response.json({ summary });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Waves failed" },
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
    const body = (await request.json()) as { toWallet?: string };
    if (!body.toWallet || !/^0x[a-fA-F0-9]{40}$/.test(body.toWallet)) {
      return Response.json({ error: "Valid toWallet required" }, { status: 400 });
    }
    if (body.toWallet.toLowerCase() === wallet) {
      return Response.json({ error: "Cannot wave yourself" }, { status: 400 });
    }
    const wave = await recordWave(wallet, body.toWallet, "free");
    const mutual = await isMutualWave(wallet, body.toWallet);
    const summary = await listWaveSummary(wallet);
    return Response.json({ wave, mutual, summary });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Wave failed" },
      { status: 500 }
    );
  }
}
