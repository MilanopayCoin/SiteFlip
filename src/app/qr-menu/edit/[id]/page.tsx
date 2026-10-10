"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import {
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_ACCENT, type MenuCategory } from "@/lib/qr-menu/types";

type EditorMenu = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: "EUR" | "TRY" | "USD" | "GBP";
  locale: "tr" | "en";
  accentColor: string;
  logoUrl: string | null;
  categories: MenuCategory[];
  published: boolean;
  editToken: string;
};

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

async function downloadQrPng(svgUrl: string, filename: string) {
  const res = await fetch(svgUrl);
  const svgText = await res.text();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("QR yüklenemedi"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas yok");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.drawImage(img, 0, 0, 1024, 1024);
  URL.revokeObjectURL(url);
  const png = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = png;
  a.download = filename;
  a.click();
}

function EditorInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const tokenFromUrl = search.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [menu, setMenu] = useState<EditorMenu | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [currency, setCurrency] = useState<EditorMenu["currency"]>("TRY");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pngBusy, setPngBusy] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl && id) {
      try {
        const stored = localStorage.getItem(`jiy-menu-${id}`);
        if (stored) setToken(stored);
      } catch {
        // ignore
      }
    }
  }, [id, tokenFromUrl]);

  useEffect(() => {
    if (!id || !token) {
      if (!token) {
        setLoading(false);
        setError(
          "Düzenleme anahtarı yok. Menüyü oluşturduğun linkten tekrar aç."
        );
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/qr-menu/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.canEdit) {
          throw new Error(data.error || "Editör açılamadı");
        }
        if (cancelled) return;
        const m = data.menu as EditorMenu;
        setMenu(m);
        setName(m.name);
        setTagline(m.tagline || "");
        setCurrency(m.currency);
        setAccentColor(m.accentColor || DEFAULT_ACCENT);
        setLogoUrl(m.logoUrl || "");
        setCategories(m.categories);
        try {
          localStorage.setItem(`jiy-menu-${m.id}`, m.editToken);
        } catch {
          // ignore
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Yükleme başarısız");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const publicUrl = useMemo(() => {
    if (!menu) return "";
    if (typeof window === "undefined") return `/m/${menu.slug}`;
    return `${window.location.origin}/m/${menu.slug}`;
  }, [menu]);

  const editUrl = useMemo(() => {
    if (!menu || !token) return "";
    if (typeof window === "undefined") {
      return `/qr-menu/edit/${menu.id}?token=${token}`;
    }
    return `${window.location.origin}/qr-menu/edit/${menu.id}?token=${encodeURIComponent(token)}`;
  }, [menu, token]);

  async function save() {
    if (!menu || !token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/qr-menu/${encodeURIComponent(menu.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken: token,
          name,
          tagline,
          currency,
          accentColor,
          logoUrl,
          categories,
          published: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız");
      setMenu(data.menu);
      setSavedAt(new Date().toLocaleTimeString("tr-TR"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Kopyalanamadı — metni elle seç.");
    }
  }

  function updateCategory(ci: number, patch: Partial<MenuCategory>) {
    setCategories((prev) =>
      prev.map((c, i) => (i === ci ? { ...c, ...patch } : c))
    );
  }

  function updateItem(
    ci: number,
    ii: number,
    patch: Partial<MenuCategory["items"][number]>
  ) {
    setCategories((prev) =>
      prev.map((c, i) => {
        if (i !== ci) return c;
        return {
          ...c,
          items: c.items.map((item, j) =>
            j === ii ? { ...item, ...patch } : item
          ),
        };
      })
    );
  }

  if (loading) {
    return (
      <div className="jiy-container py-16 text-muted">Editör yükleniyor…</div>
    );
  }

  if (error && !menu) {
    return (
      <div className="jiy-container max-w-lg py-16">
        <h1 className="font-display text-2xl font-semibold">Editör kilitli</h1>
        <p className="mt-2 text-sm text-danger">{error}</p>
        <Button asChild className="mt-6">
          <Link href="/qr-menu">Yeni ücretsiz menü oluştur</Link>
        </Button>
      </div>
    );
  }

  if (!menu) return null;

  const qrSvgPath = `/api/qr-menu/${encodeURIComponent(menu.id)}/qr?size=512`;
  const waText = encodeURIComponent(
    `${name} menümüz: ${publicUrl}`
  );

  return (
    <div className="jiy-container max-w-3xl py-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            JIY Menu · Editör
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {name || "Menün"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tamamen ücretsiz. Kaydedince misafir menüsü güncellenir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" />
              Önizle
            </a>
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </header>

      {(error || savedAt) && (
        <p className={`mt-4 text-sm ${error ? "text-danger" : "text-success"}`}>
          {error || `Kaydedildi · ${savedAt}`}
        </p>
      )}

      <section className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Paylaş
        </h2>
        <div className="space-y-2">
          <Label>Herkese açık menü linki</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={publicUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyText("link", publicUrl)}
            >
              <Copy className="mr-1 h-4 w-4" />
              {copied === "link" ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gizli düzenleme linki (sakla)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={editUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyText("edit", editUrl)}
            >
              <Copy className="mr-1 h-4 w-4" />
              {copied === "edit" ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
          <p className="text-xs text-warning">
            Bu link menüyü düzenler. WhatsApp / Instagram’da paylaşma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr-menu/${encodeURIComponent(menu.id)}/qr?size=240`}
            alt="Menü QR kodu"
            className="h-36 w-36 rounded-lg bg-white p-2"
          />
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Masaya yapıştır. Misafir okutunca menü açılır.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href={qrSvgPath} download={`jiy-menu-${menu.slug}.svg`}>
                  <Download className="mr-1 h-4 w-4" />
                  SVG
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pngBusy}
                onClick={() => {
                  setPngBusy(true);
                  void downloadQrPng(qrSvgPath, `jiy-menu-${menu.slug}.png`)
                    .catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "PNG indirilemedi"
                      )
                    )
                    .finally(() => setPngBusy(false));
                }}
              >
                <Download className="mr-1 h-4 w-4" />
                {pngBusy ? "PNG…" : "PNG"}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <a
                  href={`https://wa.me/?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Mekan & marka
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Ad</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tagline">Kısa slogan</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Kahve & mutfak"
            />
          </div>
          <div className="space-y-2">
            <Label>Para birimi</Label>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as EditorMenu["currency"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRY">TRY ₺</SelectItem>
                <SelectItem value="EUR">EUR €</SelectItem>
                <SelectItem value="USD">USD $</SelectItem>
                <SelectItem value="GBP">GBP £</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent">Vurgu rengi</Label>
            <div className="flex gap-2">
              <Input
                id="accent"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
                className="h-11 w-14 cursor-pointer p-1"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
                className="font-mono uppercase"
                maxLength={7}
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="logo">Logo URL (opsiyonel)</Label>
            <Input
              id="logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
            />
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Kategoriler & ürünler
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCategories((p) => [
                ...p,
                { id: nanoid(10), name: "Yeni kategori", items: [] },
              ])
            }
            disabled={categories.length >= 20}
          >
            <Plus className="mr-1 h-4 w-4" />
            Kategori
          </Button>
        </div>

        {categories.map((cat, ci) => (
          <div
            key={cat.id}
            className="space-y-4 border-b border-border pb-8 last:border-0"
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <Label>Kategori adı</Label>
                <Input
                  value={cat.name}
                  onChange={(e) =>
                    updateCategory(ci, { name: e.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Kategoriyi sil"
                onClick={() =>
                  setCategories((p) => p.filter((_, i) => i !== ci))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {cat.items.map((item, ii) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-lg border border-border/80 bg-surface/50 p-3 sm:grid-cols-[1fr_1fr_6.5rem_auto]"
                >
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      updateItem(ci, ii, { name: e.target.value })
                    }
                    placeholder="Ürün adı"
                  />
                  <Input
                    value={item.description || ""}
                    onChange={(e) =>
                      updateItem(ci, ii, { description: e.target.value })
                    }
                    placeholder="Kısa açıklama"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) =>
                      updateItem(ci, ii, {
                        price: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="Fiyat"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Ürünü sil"
                    onClick={() =>
                      updateCategory(ci, {
                        items: cat.items.filter((_, j) => j !== ii),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="sm:col-span-4">
                    <Textarea
                      value={(item.allergens || []).join(", ")}
                      onChange={(e) =>
                        updateItem(ci, ii, {
                          allergens: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Alerjenler (virgülle): Süt, Gluten…"
                      rows={1}
                      className="min-h-10"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Önizleme: {money(Number(item.price) || 0, currency)}
                    </p>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateCategory(ci, {
                    items: [
                      ...cat.items,
                      {
                        id: nanoid(10),
                        name: "",
                        description: "",
                        price: 0,
                        allergens: [],
                        available: true,
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Ürün ekle
              </Button>
            </div>
          </div>
        ))}
      </section>

      <div className="sticky bottom-16 z-10 mt-8 flex flex-wrap gap-3 border-t border-border bg-background/95 py-4 backdrop-blur md:bottom-0">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Kaydediliyor…" : "Menüyü kaydet"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            Misafir menüsünü aç
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function QrMenuEditPage() {
  return (
    <Suspense
      fallback={
        <div className="jiy-container py-10 text-muted">Yükleniyor…</div>
      }
    >
      <EditorInner />
    </Suspense>
  );
}
