import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { placesConfigured } from "@/lib/places/google";

export const runtime = "nodejs";

/** Proxy Google Place photos so the API key stays server-side. */
export async function GET(request: Request) {
  await ensureCloudflareEnv();

  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key || !placesConfigured()) {
    return new Response("Not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const max = Math.min(800, Math.max(120, Number(url.searchParams.get("max")) || 480));
  if (!name?.startsWith("places/")) {
    return new Response("Bad request", { status: 400 });
  }

  const mediaUrl = `https://places.googleapis.com/v1/${encodeURIComponent(name)}/media?maxHeightPx=${max}&maxWidthPx=${max}&key=${encodeURIComponent(key)}`;
  const res = await fetch(mediaUrl, { redirect: "follow" });
  if (!res.ok) {
    return new Response("Photo unavailable", { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
