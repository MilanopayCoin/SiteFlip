"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

export default function TrafikStudioPage() {
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourceDataUri, setSourceDataUri] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSource(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uri = await fileToDataUri(file);
    setSourceDataUri(uri);
    setSourcePreview(uri);
    setResultUrl(null);
    setError(null);
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setHasLogo(false);
      setLogoPreview(null);
      return;
    }
    setLogoPreview(await fileToDataUri(file));
    setHasLogo(true);
  }

  async function recreate() {
    if (!sourceDataUri) {
      setError("Önce orijinal trafik görselini yükleyin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trafik-studio/recreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDataUri,
          hasLogo,
          strength: 0.83,
        }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || "Yeniden oluşturma başarısız.");
      }
      setResultUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
          Trafik teorisi
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-white">Senaryo Stüdyosu</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Kural, yol düzeni, ok yönleri ve araç açıları korunur. Stil ve çevre
          yenilenir.
        </p>
      </div>

      <Card className="border-orange-500/20 bg-[#10233C]">
        <CardHeader>
          <CardTitle>Orijinal görsel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={onSource}
            className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-orange-500 file:px-3 file:py-1.5 file:font-semibold file:text-black"
          />
          {sourcePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourcePreview}
              alt="Orijinal senaryo"
              className="max-h-72 w-full rounded-xl bg-[#0C1A2E] object-contain"
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-500/20 bg-[#10233C]">
        <CardHeader>
          <CardTitle>Logo (isteğe bağlı)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={onLogo}
            className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
          />
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Logo"
              className="h-24 w-24 rounded-lg bg-[#0C1A2E] object-contain"
            />
          )}
        </CardContent>
      </Card>

      <Button
        className="h-12 w-full bg-orange-500 text-black hover:bg-orange-400"
        onClick={recreate}
        disabled={loading || !sourceDataUri}
      >
        {loading ? "Oluşturuluyor…" : "Senaryoyu Yeniden Oluştur"}
      </Button>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <p className="font-semibold uppercase tracking-wide">Hata</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <Card className="border-orange-500/20 bg-[#10233C]">
        <CardHeader>
          <CardTitle>Sonuç</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-10 text-center text-sm text-zinc-400">
              Senaryo yeniden oluşturuluyor… Yol düzeni ve araç açıları korunuyor.
            </p>
          )}
          {!loading && resultUrl && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Yeniden üretilen senaryo"
                className="max-h-80 w-full rounded-xl bg-[#0C1A2E] object-contain"
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" asChild>
                  <a href={resultUrl} download="trafik-studio.jpg" target="_blank" rel="noreferrer">
                    İndir
                  </a>
                </Button>
                <Button
                  className="flex-1 bg-orange-500 text-black hover:bg-orange-400"
                  onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({
                        title: "Trafik Studio",
                        url: resultUrl,
                      });
                    } else {
                      await navigator.clipboard.writeText(resultUrl);
                    }
                  }}
                >
                  Paylaş
                </Button>
              </div>
            </div>
          )}
          {!loading && !resultUrl && (
            <p className="text-sm text-zinc-500">
              Orijinal görseli yükleyip “Senaryoyu Yeniden Oluştur”a basın.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
