import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { checkIn, checkOut, listNearby } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const max = Number(new URL(request.url).searchParams.get("maxM") || 2500);
  const peers = await listNearby(wallet, Math.min(8000, Math.max(200, max)));
  return Response.json({ peers });
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
    lat?: number;
    lng?: number;
    ttlMinutes?: number;
  };
  if (
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng)
  ) {
    return Response.json({ error: "lat/lng required" }, { status: 400 });
  }
  if (Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const presence = await checkIn(wallet, body.lat, body.lng, body.ttlMinutes);
  return Response.json({ presence });
}

export async function DELETE(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await checkOut(wallet);
  return Response.json({ ok: true });
}
