import { FalFluxImg2ImgProvider } from "@/ai/providers/fal-flux-img2img";
import type { ImageToImageProvider } from "@/ai/types";

/**
 * Aktif sağlayıcı kaydı. Yeni model eklemek için:
 * 1. `src/ai/providers/` altına sınıf yazın
 * 2. Buraya kaydedin
 * 3. `EXPO_PUBLIC_AI_PROVIDER` ile seçin
 */
const registry: Record<string, () => ImageToImageProvider> = {
  "fal-flux-dev-img2img": () => new FalFluxImg2ImgProvider(),
};

const DEFAULT_PROVIDER = "fal-flux-dev-img2img";

export function getImageToImageProvider(): ImageToImageProvider {
  const key =
    process.env.EXPO_PUBLIC_AI_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const factory = registry[key] ?? registry[DEFAULT_PROVIDER];
  return factory();
}

export { buildRecreatePrompt, TRAFFIC_SCENARIO_PROMPT } from "@/ai/prompts";
export {
  AiClientError,
  type ImageToImageProvider,
  type LocalImage,
  type RecreateResult,
} from "@/ai/types";
