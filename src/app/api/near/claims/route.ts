import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  claimTable,
  listClaims,
  myClaim,
  releaseClaim,
} from "@/lib/near/claims";
import { getPresence } from "@/lib/near/store";

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
    const presence = await getPresence(wallet);
    if (!presence) {
      return Response.json({
        claims: [],
        mine: null,
        geohash: null,
        hint: "Check-in required",
      });
    }
    const [claims, mine] = await Promise.all([
      listClaims(presence.geohash),
      myClaim(wallet),
    ]);
    return Response.json({
      claims,
      mine,
      geohash: presence.geohash.slice(0, 5),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Claims failed" },
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
    const presence = await getPresence(wallet);
    if (!presence) {
      return Response.json({ error: "Check-in required" }, { status: 400 });
    }
    const body = (await request.json()) as {
      label?: string;
      ttlMinutes?: number;
    };
    const claim = await claimTable({
      wallet,
      geohash: presence.geohash,
      label: body.label || "Masa",
      ttlMinutes: body.ttlMinutes,
    });
    const claims = await listClaims(presence.geohash);
    return Response.json({ claim, claims });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Claim failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await releaseClaim(wallet);
    const presence = await getPresence(wallet);
    const claims = presence ? await listClaims(presence.geohash) : [];
    return Response.json({ ok: true, claims, mine: null });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Release failed" },
      { status: 500 }
    );
  }
}
