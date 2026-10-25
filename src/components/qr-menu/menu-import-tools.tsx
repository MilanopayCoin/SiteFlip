"use client";

import { useState } from "react";
import { Loader2, Sparkles, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuCategory, VenueMetadata } from "@/lib/qr-menu/types";
import type { MenuMarket } from "@/lib/places/markets";

type Props = {
  menuId: string;
  editToken: string;
  venue: VenueMetadata | null | undefined;
  onMenuUpdated: (categories: MenuCategory[], message?: string) => void;
  onVenueUpdated?: (venue: VenueMetadata) => void;
};

export function MenuImportTools({
  menuId,
  editToken,
  venue,
  onMenuUpdated,
  onVenueUpdated,
}: Props) {
  const market: MenuMarket = venue?.market === "tr" ? "tr" : "nl";
  const [url, setUrl] = useState(venue?.website?.startsWith("http") ? venue.website : venue?.website ? `https://${venue.website}` : "");
  const [busy, setBusy] = useState<"import" | "suggest" | "trust" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runImport(useVenueWebsite: boolean) {
    setBusy("import");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/qr-menu/${encodeURIComponent(menuId)}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken,
          url: useVenueWebsite ? undefined : url.trim(),
          useVenueWebsite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onMenuUpdated(
        data.menu.categories as MenuCategory[],
        market === "tr"
          ? `${data.import.itemCount} ürün içe aktarıldı (${data.import.method})`
          : `${data.import.itemCount} items geïmporteerd (${data.import.method})`
      );
      const warnings = (data.import.warnings as string[] | undefined)?.join(" ");
      if (warnings) setMsg(warnings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function runSuggest() {
    setBusy("suggest");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/qr-menu/${encodeURIComponent(menuId)}/suggest-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editToken, count: 6 }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggest failed");
      onMenuUpdated(data.menu.categories as MenuCategory[], data.suggest.note as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setBusy(null);
    }
  }

  async function refreshTrustpilot() {
    setBusy("trust");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/qr-menu/${encodeURIComponent(menuId)}/refresh-trustpilot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editToken }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trustpilot refresh failed");
      const tp = data.trustpilot as {
        trustScore: number | null;
        reviewCount: number | null;
      };
      if (data.menu?.venueDetail) {
        onVenueUpdated?.(data.menu.venueDetail as VenueMetadata);
      }
      setMsg(
        tp.trustScore != null
          ? `Trustpilot ${tp.trustScore} (${tp.reviewCount ?? 0})`
          : market === "tr"
            ? "Trustpilot puanı alınamadı — API anahtarını kontrol edin."
            : "Geen Trustpilot-score — controleer API-sleutel."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {market === "tr" ? "Hızlı doldur" : "Snel vullen"}
      </h2>

      <div className="space-y-2">
        <Label htmlFor="menu-url">
          {market === "tr" ? "Menü web adresi" : "Menu-website URL"}
        </Label>
        <Input
          id="menu-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null || url.trim().length < 8}
            onClick={() => void runImport(false)}
          >
            {busy === "import" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-1 h-4 w-4" />
            )}
            {market === "tr" ? "URL'den içe aktar" : "Importeren van URL"}
          </Button>
          {venue?.website && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void runImport(true)}
            >
              {market === "tr" ? "Google web sitesi" : "Google-website"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void runSuggest()}
          >
            {busy === "suggest" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            {market === "tr" ? "AI ürün öner" : "AI-suggesties"}
          </Button>
          {venue?.website && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void refreshTrustpilot()}
            >
              {busy === "trust" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              Trustpilot
            </Button>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}
      <p className="text-xs text-muted">
        {market === "tr"
          ? "İçe aktarılan fiyatları yayınlamadan önce kontrol edin."
          : "Controleer geïmporteerde prijzen vóór publicatie."}
      </p>
    </section>
  );
}
