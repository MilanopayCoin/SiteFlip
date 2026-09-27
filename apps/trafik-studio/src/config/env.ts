import Constants from "expo-constants";

/**
 * Expo, EXPO_PUBLIC_* değişkenlerini bundle’a enjekte eder.
 * Yerel geliştirmede kökteki `.env` dosyasını kullanın.
 */
type Extra = {
  falKey?: string;
  falModel?: string;
  img2imgStrength?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function getFalKey(): string {
  return (
    process.env.EXPO_PUBLIC_FAL_KEY ||
    extra().falKey ||
    ""
  ).trim();
}

export function getFalModelId(): string {
  return (
    process.env.EXPO_PUBLIC_FAL_MODEL ||
    extra().falModel ||
    "fal-ai/flux/dev/image-to-image"
  ).trim();
}

/** Kritik pozisyonları korumak için 0.78–0.88 aralığı. */
export function getImageStrength(): number {
  const raw =
    process.env.EXPO_PUBLIC_IMG2IMG_STRENGTH || extra().img2imgStrength || "0.83";
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.83;
  return Math.min(0.88, Math.max(0.78, n));
}
