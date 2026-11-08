import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  issueNonce,
  verifyAndCreateSession,
} from "@/lib/near/auth";

export const runtime = "nodejs";

/** GET ?wallet=0x… → challenge message to sign with StarKey. */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ error: "Valid wallet required" }, { status: 400 });
  }
  const challenge = await issueNonce(wallet);
  return Response.json(challenge);
}

/** POST { wallet, nonce, issuedAt, signature } → HMAC session token. */
export async function POST(request: Request) {
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
}
