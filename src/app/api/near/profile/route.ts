import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { getProfile, upsertProfile } from "@/lib/near/store";

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
    const profile = await getProfile(wallet);
    return Response.json({ profile });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Profile load failed" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
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
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Profile save failed" },
      { status: 500 }
    );
  }
}
