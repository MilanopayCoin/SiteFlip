import { File, Paths } from "expo-file-system";

import type { LocalImage } from "@/ai/types";

function guessMime(uri: string, fallback = "image/jpeg"): string {
  const lower = uri.toLowerCase();
  if (lower.includes(".png") || lower.includes("image/png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".heic")) return "image/heic";
  return fallback;
}

/**
 * Picker URI'sini Fal'ın kabul ettiği data URI'ye çevirir.
 * expo-image-picker `base64` verdiyse onu kullanır; yoksa FileSystem okur.
 */
export async function toLocalImage(input: {
  uri: string;
  mimeType?: string | null;
  base64?: string | null;
}): Promise<LocalImage> {
  const mimeType = input.mimeType || guessMime(input.uri);
  if (input.base64) {
    return {
      uri: input.uri,
      mimeType,
      dataUri: `data:${mimeType};base64,${input.base64}`,
    };
  }

  const file = new File(input.uri);
  const encoded = await file.base64();
  return {
    uri: input.uri,
    mimeType,
    dataUri: `data:${mimeType};base64,${encoded}`,
  };
}

/** Uzak sonuç görselini cache'e indirir (paylaş / kaydet). */
export async function downloadToCache(remoteUrl: string): Promise<string> {
  const filename = `trafik-studio-${Date.now()}.jpg`;
  const dest = new File(Paths.cache, filename);
  const output = await File.downloadFileAsync(remoteUrl, dest, { idempotent: true });
  return output.uri;
}
