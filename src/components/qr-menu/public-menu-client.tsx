"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { collectAllergens, type MenuSpecial } from "@/lib/qr-menu/types";

type PubItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  allergens: string[];
};

type PubCategory = {
  id: string;
  name: string;
  items: PubItem[];
};

export type PublicMenuData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: string;
  locale: "tr" | "en";
  accentColor: string;
  logoUrl: string | null;
  special: MenuSpecial | null;
  categories: PubCategory[];
};

function formatPrice(n: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-EU", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "TRY" ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function itemSafe(item: PubItem, avoid: Set<string>): boolean {
  if (avoid.size === 0) return true;
  const lower = new Set(item.allergens.map((a) => a.toLowerCase()));
  for (const a of avoid) {
    if (lower.has(a.toLowerCase())) return false;
  }
  return true;
}

export function PublicMenuClient({
  menu,
  tableLabel,
}: {
  menu: PublicMenuData;
  tableLabel: string | null;
}) {
  const accent = menu.accentColor;
  const isTr = menu.locale !== "en";
  const allergens = useMemo(
    () => collectAllergens(menu.categories),
    [menu.categories]
  );
  const [avoid, setAvoid] = useState<string[]>([]);
  const [calling, setCalling] = useState(false);
  const [callOk, setCallOk] = useState<string | null>(null);
  const [callErr, setCallErr] = useState<string | null>(null);

  const avoidSet = useMemo(() => new Set(avoid), [avoid]);

  const filtered = useMemo(() => {
    return menu.categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => itemSafe(i, avoidSet)),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu.categories, avoidSet]);

  function toggleAllergen(a: string) {
    setAvoid((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function callWaiter() {
    setCalling(true);
    setCallErr(null);
    setCallOk(null);
    try {
      const res = await fetch(`/api/qr-menu/${encodeURIComponent(menu.id)}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableLabel: tableLabel || (isTr ? "Masa" : "Table"),
          note: isTr ? "Garson lütfen" : "Please come to the table",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call failed");
      setCallOk(isTr ? "Çağrı gönderildi — garson yolda." : "Call sent — waiter notified.");
    } catch (err) {
      setCallErr(err instanceof Error ? err.message : "Error");
    } finally {
      setCalling(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground"
      style={{ ["--menu-accent" as string]: accent }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% -10%, color-mix(in srgb, ${accent} 22%, transparent), transparent 55%)`,
        }}
      />

      {menu.special ? (
        <div
          className="relative z-10 border-b px-4 py-3 text-center"
          style={{
            borderColor: `${accent}55`,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            {isTr ? "Günün spesiyali" : "Today's special"}
          </p>
          <p className="mt-1 font-display text-lg font-semibold tracking-tight">
            {menu.special.title}
            {menu.special.price != null ? (
              <span className="ml-2 tabular" style={{ color: accent }}>
                {formatPrice(menu.special.price, menu.currency, menu.locale)}
              </span>
            ) : null}
          </p>
          {menu.special.description ? (
            <p className="mt-0.5 text-sm text-muted">{menu.special.description}</p>
          ) : null}
        </div>
      ) : null}

      <header className="relative border-b border-border/80">
        <div className="mx-auto max-w-lg px-5 pb-8 pt-12 text-center sm:pt-16">
          {menu.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={menu.logoUrl}
              alt=""
              className="mx-auto mb-5 h-16 w-16 rounded-full object-cover ring-1 ring-border"
            />
          ) : null}
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {isTr ? "Menü" : "Menu"}
            {tableLabel ? ` · ${isTr ? "Masa" : "Table"} ${tableLabel}` : ""}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {menu.name}
          </h1>
          {menu.tagline && (
            <p className="mx-auto mt-3 max-w-sm text-base text-muted">
              {menu.tagline}
            </p>
          )}
        </div>
      </header>

      {allergens.length > 0 && (
        <section className="relative mx-auto max-w-lg px-5 pt-6">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" />
            {isTr
              ? "Alerjen lens — sakınmak istediğini seç, menü filtrelenir"
              : "Allergen lens — pick what to avoid"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {allergens.map((a) => {
              const on = avoid.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    on
                      ? {
                          borderColor: accent,
                          background: accent,
                          color: "#0a0a0b",
                        }
                      : { borderColor: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {on ? (isTr ? `− ${a}` : `− ${a}`) : a}
                </button>
              );
            })}
          </div>
          {avoid.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {isTr
                ? `${avoid.join(", ")} içeren ürünler gizlendi.`
                : `Hiding items with ${avoid.join(", ")}.`}
            </p>
          )}
        </section>
      )}

      <main className="relative mx-auto max-w-lg px-5 py-10 pb-28">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted">
            {isTr
              ? "Bu filtreyle görünecek ürün yok."
              : "No items match this filter."}
          </p>
        ) : (
          <div className="space-y-12">
            {filtered.map((cat) => (
              <section key={cat.id}>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {cat.name}
                </h2>
                <ul className="mt-5 space-y-5">
                  {cat.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 border-b border-border/70 pb-5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium tracking-tight">{item.name}</p>
                        {item.description ? (
                          <p className="mt-1 text-sm text-muted">
                            {item.description}
                          </p>
                        ) : null}
                        {item.allergens?.length ? (
                          <p className="mt-2 text-[11px] uppercase tracking-wide text-muted/80">
                            {item.allergens.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <p
                        className="shrink-0 tabular font-medium"
                        style={{ color: accent }}
                      >
                        {formatPrice(item.price, menu.currency, menu.locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {(callOk || callErr) && (
            <p className={`text-center text-xs ${callErr ? "text-danger" : "text-success"}`}>
              {callOk || callErr}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={calling}
            onClick={() => void callWaiter()}
            style={{ background: accent, color: "#0a0a0b" }}
          >
            <BellRing className="mr-2 h-4 w-4" />
            {calling
              ? isTr
                ? "Çağrılıyor…"
                : "Calling…"
              : tableLabel
                ? isTr
                  ? `Garson çağır · Masa ${tableLabel}`
                  : `Call waiter · Table ${tableLabel}`
                : isTr
                  ? "Garson çağır"
                  : "Call waiter"}
          </Button>
          <p className="text-center text-[10px] text-muted">
            {isTr ? "Ücretsiz menü · " : "Free menu by "}
            <Link href="/" className="hover:underline" style={{ color: accent }}>
              JIY Menu
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
