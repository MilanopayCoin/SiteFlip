import axios, { AxiosError } from "axios";

import { getFalKey, getFalModelId } from "@/config/env";
import {
  AiClientError,
  type ImageToImageProvider,
  type RecreateInput,
  type RecreateResult,
} from "@/ai/types";

type FalImage = { url?: string; content_type?: string };
type FalResponse = {
  images?: FalImage[];
  image?: FalImage;
  seed?: number;
  detail?: string;
  error?: string;
};

/**
 * Fal.ai FLUX.1 [dev] image-to-image.
 * Endpoint: POST https://fal.run/fal-ai/flux/dev/image-to-image
 *
 * Not: Bu model tek `image_url` kabul eder. Logo, prompt üzerinden
 * (ve isteğe bağlı ileride ayrı bir compose modeli ile) işlenir.
 */
export class FalFluxImg2ImgProvider implements ImageToImageProvider {
  readonly id = "fal-flux-dev-img2img";
  readonly label = "Fal.ai Flux img2img";

  async recreate(input: RecreateInput): Promise<RecreateResult> {
    const key = getFalKey();
    if (!key) {
      throw new AiClientError(
        "Fal.ai API anahtarı yok. apps/trafik-studio/.env dosyasına EXPO_PUBLIC_FAL_KEY ekleyin.",
        "MISSING_API_KEY"
      );
    }

    const modelId = getFalModelId();
    const url = `https://fal.run/${modelId.replace(/^\/+/, "")}`;

    // Flux img2img tek `image_url` alır; logo prompt ile iletilir.
    const body: Record<string, unknown> = {
      image_url: input.source.dataUri,
      prompt: input.prompt,
      strength: input.strength,
      num_inference_steps: 40,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
    };

    try {
      const { data } = await axios.post<FalResponse>(url, body, {
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      });

      const imageUrl = data.images?.[0]?.url ?? data.image?.url;
      if (!imageUrl) {
        throw new AiClientError(
          "Fal.ai sonuç görseli döndürmedi.",
          "EMPTY_RESULT"
        );
      }

      return {
        imageUrl,
        seed: data.seed,
        modelId,
      };
    } catch (err) {
      if (err instanceof AiClientError) throw err;
      const ax = err as AxiosError<FalResponse>;
      const status = ax.response?.status;
      const detail =
        ax.response?.data?.detail ||
        ax.response?.data?.error ||
        ax.message ||
        "Bilinmeyen ağ hatası";
      throw new AiClientError(
        status ? `Fal.ai hatası (${status}): ${detail}` : `Fal.ai hatası: ${detail}`,
        "NETWORK"
      );
    }
  }
}
