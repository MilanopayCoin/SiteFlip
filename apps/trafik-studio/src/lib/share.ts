import * as Sharing from "expo-sharing";

import { downloadToCache } from "@/lib/images";

export async function shareRemoteImage(remoteUrl: string): Promise<void> {
  const localUri = await downloadToCache(remoteUrl);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Bu cihazda paylaşım desteklenmiyor.");
  }
  await Sharing.shareAsync(localUri, {
    mimeType: "image/jpeg",
    dialogTitle: "Senaryo görselini paylaş",
  });
}

/** İndir = cache'e kaydet + paylaşım sayfası (Fotoğraflar'a kaydet seçilebilir). */
export async function saveRemoteImage(remoteUrl: string): Promise<string> {
  return downloadToCache(remoteUrl);
}
