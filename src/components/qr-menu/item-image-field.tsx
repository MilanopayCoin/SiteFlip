"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImageToDataUri } from "@/lib/qr-menu/image";

export function ItemImageField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Sadece görsel dosyası");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const uri = await compressImageToDataUri(file);
      onChange(uri);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yükleme başarısız");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted">
          <ImagePlus className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          {busy ? "Sıkıştırılıyor…" : value ? "Değiştir" : "Fotoğraf"}
        </Button>
        {value ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange("")}
            aria-label="Fotoğrafı kaldır"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      {err ? <p className="w-full text-xs text-danger">{err}</p> : null}
    </div>
  );
}
