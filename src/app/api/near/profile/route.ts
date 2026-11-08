import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { getProfile, upsertProfile } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfile(wallet);
  return Response.json({ profile });
}

export async function PUT(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    displayName?: string;
    mood?: string;
    bio?: string;
    avatarEmoji?: string;
  };
  const profile = await upsertProfile(wallet, body);
  return Response.json({ profile });
}
