/** Client-side menu item image helpers (compress for JSONB storage). */

export const MAX_ITEM_IMAGE_CHARS = 160_000; // ~120KB data URI
export const MAX_ITEM_IMAGE_EDGE = 640;

/**
 * Resize + JPEG-compress a File/Blob to a data URI suitable for menu JSON.
 */
export async function compressImageToDataUri(
  file: Blob,
  opts?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? MAX_ITEM_IMAGE_EDGE;
  const quality = opts?.quality ?? 0.72;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas desteklenmiyor");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let q = quality;
  let dataUri = canvas.toDataURL("image/jpeg", q);
  while (dataUri.length > MAX_ITEM_IMAGE_CHARS && q > 0.4) {
    q -= 0.08;
    dataUri = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUri.length > MAX_ITEM_IMAGE_CHARS) {
    // Second pass: smaller edge
    const canvas2 = document.createElement("canvas");
    const edge = 420;
    const s2 = Math.min(1, edge / Math.max(w, h));
    canvas2.width = Math.max(1, Math.round(w * s2));
    canvas2.height = Math.max(1, Math.round(h * s2));
    const ctx2 = canvas2.getContext("2d");
    if (!ctx2) throw new Error("Canvas desteklenmiyor");
    ctx2.fillStyle = "#ffffff";
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
    ctx2.drawImage(canvas, 0, 0, canvas2.width, canvas2.height);
    dataUri = canvas2.toDataURL("image/jpeg", 0.65);
  }
  if (dataUri.length > MAX_ITEM_IMAGE_CHARS) {
    throw new Error("Görsel çok büyük — daha küçük bir fotoğraf deneyin");
  }
  return dataUri;
}

export function filenameToItemName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Yeni ürün";
  return base.charAt(0).toUpperCase() + base.slice(1).slice(0, 80);
}

export function isAllowedItemImage(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value.length <= 500;
  }
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    return value.length <= MAX_ITEM_IMAGE_CHARS;
  }
  return false;
}
