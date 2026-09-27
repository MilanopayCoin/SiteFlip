import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";

import type { LocalImage } from "@/ai/types";
import { toLocalImage } from "@/lib/images";

/**
 * Galeri / kameradan görsel seçer.
 * `kind` sadece izin mesajı ve UI için ayrılır (kaynak vs logo).
 */
export function useImagePicker() {
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async (): Promise<LocalImage | null> => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Galeri izni verilmedi.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.92,
        base64: true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) return null;
      const asset = result.assets[0];
      return toLocalImage({
        uri: asset.uri,
        mimeType: asset.mimeType,
        base64: asset.base64,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  return { pick, busy };
}
