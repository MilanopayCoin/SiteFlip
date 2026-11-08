import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { createCall, getCall, listIncoming, pushSignal, pullSignals } from "@/lib/near/calls";
import type { NearCallSignalKind } from "@/lib/near/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  const after = Number(url.searchParams.get("after") || 0);

  if (callId) {
    const call = await getCall(callId);
    if (!call) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (call.fromWallet !== wallet && call.toWallet !== wallet) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const signals = await pullSignals(callId, after, wallet);
    return Response.json({ call, signals });
  }

  const incoming = await listIncoming(wallet);
  return Response.json({ incoming });
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
    peerWallet?: string;
    callId?: string;
    kind?: NearCallSignalKind;
    payload?: unknown;
  };

  if (body.peerWallet && !body.callId) {
    const call = await createCall(wallet, body.peerWallet);
    return Response.json({ call });
  }

  if (body.callId && body.kind) {
    const sig = await pushSignal({
      callId: body.callId,
      fromWallet: wallet,
      kind: body.kind,
      payload: body.payload ?? {},
    });
    return Response.json({ signal: sig });
  }

  return Response.json({ error: "Invalid body" }, { status: 400 });
}
