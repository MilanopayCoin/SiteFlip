"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import {
  Copy,
  Download,
  ExternalLink,
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
import { MenuImportTools } from "@/components/qr-menu/menu-import-tools";
import type { MenuCategory, VenueMetadata } from "@/lib/qr-menu/types";

type EditorMenu = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: "EUR" | "TRY" | "USD" | "GBP";
  categories: MenuCategory[];
  published: boolean;
  editToken: string;
  venueDetail?: VenueMetadata | null;
};

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
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
  const [currency, setCurrency] = useState<EditorMenu["currency"]>("EUR");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [venueDetail, setVenueDetail] = useState<VenueMetadata | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

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
        setError("Missing edit token. Open the link from when you created the menu.");
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
          throw new Error(data.error || "Cannot open editor");
        }
        if (cancelled) return;
        const m = data.menu as EditorMenu;
        setMenu(m);
        setName(m.name);
        setTagline(m.tagline || "");
        setCurrency(m.currency);
        setCategories(m.categories);
        setVenueDetail(m.venueDetail ?? null);
        try {
          localStorage.setItem(`jiy-menu-${m.id}`, m.editToken);
        } catch {
          // ignore
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
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
          categories,
          published: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMenu(data.menu);
      setVenueDetail(data.menu.venueDetail ?? null);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
      setError("Could not copy — select the link manually.");
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
      <div className="jiy-container py-16 text-muted">Loading editor…</div>
    );
  }

  if (error && !menu) {
    return (
      <div className="jiy-container max-w-lg py-16">
        <h1 className="font-display text-2xl font-semibold">Editor locked</h1>
        <p className="mt-2 text-sm text-danger">{error}</p>
        <Button asChild className="mt-6">
          <Link href="/qr-menu">Create a new free menu</Link>
        </Button>
      </div>
    );
  }

  if (!menu) return null;

  return (
    <div className="jiy-container max-w-3xl py-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            JIY Menu · Editor
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {name || "Your menu"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Free forever. Changes go live when you save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" />
              Preview
            </a>
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {(error || savedAt || importNotice) && (
        <p
          className={`mt-4 text-sm ${error ? "text-danger" : "text-success"}`}
        >
          {error || importNotice || `Saved at ${savedAt}`}
        </p>
      )}

      <MenuImportTools
        menuId={menu.id}
        editToken={token}
        venue={venueDetail}
        onMenuUpdated={(cats, message) => {
          setCategories(cats);
          setImportNotice(message ?? null);
          setTimeout(() => setImportNotice(null), 8000);
        }}
        onVenueUpdated={setVenueDetail}
      />

      <section className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Share
        </h2>
        <div className="space-y-2">
          <Label>Public link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={publicUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyText("link", publicUrl)}
            >
              <Copy className="mr-1 h-4 w-4" />
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr-menu/${encodeURIComponent(menu.id)}/qr?size=240`}
            alt="Menu QR code"
            className="h-36 w-36 rounded-lg bg-white p-2"
          />
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Print this QR for tables. Guests scan → open the menu.
            </p>
            <Button type="button" variant="outline" asChild>
              <a
                href={`/api/qr-menu/${encodeURIComponent(menu.id)}/qr?size=512`}
                download={`jiy-menu-${menu.slug}.svg`}
              >
                <Download className="mr-1 h-4 w-4" />
                Download QR (SVG)
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Venue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Kitchen & coffee"
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as EditorMenu["currency"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR €</SelectItem>
                <SelectItem value="TRY">TRY ₺</SelectItem>
                <SelectItem value="USD">USD $</SelectItem>
                <SelectItem value="GBP">GBP £</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Categories & items
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCategories((p) => [
                ...p,
                { id: nanoid(10), name: "New category", items: [] },
              ])
            }
            disabled={categories.length >= 20}
          >
            <Plus className="mr-1 h-4 w-4" />
            Category
          </Button>
        </div>

        {categories.map((cat, ci) => (
          <div
            key={cat.id}
            className="space-y-4 border-b border-border pb-8 last:border-0"
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <Label>Category name</Label>
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
                aria-label="Remove category"
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
                    placeholder="Item name"
                  />
                  <Input
                    value={item.description || ""}
                    onChange={(e) =>
                      updateItem(ci, ii, { description: e.target.value })
                    }
                    placeholder="Short description"
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
                    placeholder="Price"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
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
                      placeholder="Allergens (comma-separated): Milk, Gluten…"
                      rows={1}
                      className="min-h-10"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Preview price: {money(Number(item.price) || 0, currency)}
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
                Add item
              </Button>
            </div>
          </div>
        ))}
      </section>

      <div className="sticky bottom-16 z-10 mt-8 flex flex-wrap gap-3 border-t border-border bg-background/95 py-4 backdrop-blur md:bottom-0">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Saving…" : "Save menu"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            Open public menu
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function QrMenuEditPage() {
  return (
    <Suspense
      fallback={<div className="jiy-container py-10 text-muted">Loading…</div>}
    >
      <EditorInner />
    </Suspense>
  );
}
