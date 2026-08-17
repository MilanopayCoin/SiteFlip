import { ensureCloudflareEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

const DEFAULT_PROMPT = `Recreate this exact traffic theory scenario. Strictly preserve the road layout, the direction and meaning of all arrows, and the exact angles and relative positions of all vehicles. Keep the traffic rule being illustrated identical. The overall composition and vehicle placement must stay the same. Style, colors, lighting, buildings and secondary details can be refreshed. If a logo is provided, place it naturally on the vehicles.`;

function clampStrength(n: number): number {
  if (!Number.isFinite(n)) return 0.83;
  return Math.min(0.88, Math.max(0.78, n));
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const falKey = (
    process.env.FAL_KEY ||
    process.env.EXPO_PUBLIC_FAL_KEY ||
    ""
  ).trim();
  if (!falKey) {
    return Response.json(
      {
        error:
          "FAL_KEY is not configured on this Worker. Add it as a Cloudflare secret, then redeploy.",
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    sourceDataUri?: string;
    hasLogo?: boolean;
    strength?: number;
  } | null;

  const sourceDataUri = body?.sourceDataUri;
  if (!sourceDataUri || !sourceDataUri.startsWith("data:image/")) {
    return Response.json({ error: "Orijinal görsel gerekli." }, { status: 400 });
  }

  const strength = clampStrength(Number(body?.strength ?? 0.83));
  const prompt = body?.hasLogo
    ? `${DEFAULT_PROMPT} Integrate the provided driving-school logo naturally onto the vehicles (doors, hood or side panels) without covering arrows, signs or the road layout.`
    : DEFAULT_PROMPT;

  const modelId = (
    process.env.FAL_MODEL ||
    process.env.EXPO_PUBLIC_FAL_MODEL ||
    "fal-ai/flux/dev/image-to-image"
  ).replace(/^\/+/, "");

  try {
    const res = await fetch(`https://fal.run/${modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: sourceDataUri,
        prompt,
        strength,
        num_inference_steps: 40,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "jpeg",
        enable_safety_checker: true,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      images?: Array<{ url?: string }>;
      image?: { url?: string };
      detail?: string;
      error?: string;
    };

    if (!res.ok) {
      return Response.json(
        {
          error: data.detail || data.error || `Fal.ai HTTP ${res.status}`,
        },
        { status: 502 }
      );
    }

    const imageUrl = data.images?.[0]?.url || data.image?.url;
    if (!imageUrl) {
      return Response.json(
        { error: "Fal.ai sonuç görseli döndürmedi." },
        { status: 502 }
      );
    }

    return Response.json({ imageUrl, strength, modelId });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Fal.ai isteği başarısız.",
      },
      { status: 502 }
    );
  }
}
