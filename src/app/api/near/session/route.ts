import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  issueNonce,
  nearSessionSecret,
  verifyAndCreateSession,
} from "@/lib/near/auth";

export const runtime = "nodejs";

function sessionMisconfigResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("NEAR_SESSION_SECRET")) {
    return Response.json(
      { error: "Near session misconfigured — NEAR_SESSION_SECRET required" },
      { status: 503 }
    );
  }
  return null;
}

/** GET ?wallet=0x… → challenge message to sign with StarKey. */
export async function GET(request: Request) {
  try {
    await ensureCloudflareEnv();
    nearSessionSecret(); // fail-closed before issuing a challenge
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return Response.json({ error: "Valid wallet required" }, { status: 400 });
    }
    const challenge = await issueNonce(wallet);
    return Response.json(challenge);
  } catch (e) {
    return (
      sessionMisconfigResponse(e) ||
      Response.json(
        { error: e instanceof Error ? e.message : "Session challenge failed" },
        { status: 500 }
      )
    );
  }
}

/** POST { wallet, nonce, issuedAt, signature } → HMAC session token. */
export async function POST(request: Request) {
  try {
    await ensureCloudflareEnv();
    const body = (await request.json()) as {
      wallet?: string;
      nonce?: string;
      issuedAt?: string;
      signature?: string;
    };
    if (!body.wallet || !body.nonce || !body.issuedAt || !body.signature) {
      return Response.json(
        { error: "wallet, nonce, issuedAt, signature required" },
        { status: 400 }
      );
    }
    const session = await verifyAndCreateSession({
      wallet: body.wallet,
      nonce: body.nonce,
      issuedAt: body.issuedAt,
      signature: body.signature as `0x${string}`,
    });
    if (!session) {
      return Response.json(
        { error: "Invalid signature or expired challenge" },
        { status: 401 }
      );
    }
    return Response.json({ session });
  } catch (e) {
    return (
      sessionMisconfigResponse(e) ||
      Response.json(
        { error: e instanceof Error ? e.message : "Session create failed" },
        { status: 500 }
      )
    );
  }
}
