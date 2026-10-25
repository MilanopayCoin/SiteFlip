"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Filter,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  recommendItems,
  type WizardAnswers,
} from "@/lib/qr-menu/recommend";
import { collectAllergens, type MenuSpecial } from "@/lib/qr-menu/types";

type PubItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  allergens: string[];
  imageUrl?: string;
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

const QUIET_CHIPS_TR = [
  { id: "su", label: "Su", note: "Su lütfen" },
  { id: "hesap", label: "Hesap", note: "Hesap lütfen" },
  { id: "sos", label: "Ekstra sos", note: "Ekstra sos lütfen" },
  { id: "pecete", label: "Peçete", note: "Peçete lütfen" },
  { id: "garson", label: "Garson", note: "Garson lütfen" },
] as const;

const QUIET_CHIPS_EN = [
  { id: "water", label: "Water", note: "Water please" },
  { id: "bill", label: "Bill", note: "Bill please" },
  { id: "sauce", label: "Extra sauce", note: "Extra sauce please" },
  { id: "napkin", label: "Napkin", note: "Napkin please" },
  { id: "waiter", label: "Waiter", note: "Please come to the table" },
] as const;

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
  const chips = isTr ? QUIET_CHIPS_TR : QUIET_CHIPS_EN;
  const allergens = useMemo(
    () => collectAllergens(menu.categories),
    [menu.categories]
  );
  const [avoid, setAvoid] = useState<string[]>([]);
  const [safePath, setSafePath] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callOk, setCallOk] = useState<string | null>(null);
  const [callErr, setCallErr] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({
    diet: "any",
    spice: "any",
    budget: "any",
  });
  const [picks, setPicks] = useState<ReturnType<typeof recommendItems> | null>(
    null
  );

  const avoidSet = useMemo(() => new Set(avoid), [avoid]);
  const lensOn = avoid.length > 0 || safePath;

  const filtered = useMemo(() => {
    if (!lensOn) return menu.categories;
    return menu.categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => itemSafe(i, avoidSet)),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu.categories, avoidSet, lensOn]);

  const safeCount = useMemo(() => {
    let n = 0;
    for (const c of menu.categories) {
      for (const i of c.items) {
        if (itemSafe(i, avoidSet)) n++;
      }
    }
    return n;
  }, [menu.categories, avoidSet]);

  function toggleAllergen(a: string) {
    setAvoid((prev) => {
      const next = prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a];
      if (next.length > 0) setSafePath(true);
      return next;
    });
    setPicks(null);
  }

  async function sendNote(note: string) {
    setCalling(true);
    setCallErr(null);
    setCallOk(null);
    try {
      const res = await fetch(
        `/api/qr-menu/${encodeURIComponent(menu.id)}/calls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableLabel: tableLabel || (isTr ? "Masa" : "Table"),
            note,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call failed");
      setCallOk(
        isTr ? `Gönderildi: ${note}` : `Sent: ${note}`
      );
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
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
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
            <p className="mt-0.5 text-sm text-muted">
              {menu.special.description}
            </p>
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
          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWizardOpen(true);
                setWizardStep(0);
                setPicks(null);
              }}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              {isTr ? "Ne yiyebilirim?" : "What can I eat?"}
            </Button>
          </div>
        </div>
      </header>

      {allergens.length > 0 && (
        <section className="relative mx-auto max-w-lg px-5 pt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Filter className="h-3.5 w-3.5" />
              {isTr
                ? "Alerjen lens — sakınmak istediğini seç"
                : "Allergen lens — pick what to avoid"}
            </div>
            {(avoid.length > 0 || safePath) && (
              <button
                type="button"
                onClick={() => setSafePath((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={
                  safePath
                    ? {
                        borderColor: "#34d399",
                        background: "rgba(52,211,153,0.15)",
                        color: "#34d399",
                      }
                    : { borderColor: "var(--border)", color: "var(--muted)" }
                }
              >
                <Sparkles className="h-3 w-3" />
                {isTr ? "Güvenli yol" : "Safe path"}
              </button>
            )}
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
                  {on ? `− ${a}` : a}
                </button>
              );
            })}
          </div>
          {safePath && avoid.length > 0 && (
            <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {isTr
                ? `Güvenli yol açık — ${safeCount} ürün senin için güvenli.`
                : `Safe path on — ${safeCount} items look safe for you.`}
            </p>
          )}
          {avoid.length > 0 && !safePath && (
            <p className="mt-2 text-xs text-muted">
              {isTr
                ? `${avoid.join(", ")} içeren ürünler gizlendi.`
                : `Hiding items with ${avoid.join(", ")}.`}
            </p>
          )}
        </section>
      )}

      {picks && picks.length > 0 && (
        <section className="relative mx-auto max-w-lg px-5 pt-6">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            {isTr ? "Senin için öneriler" : "Picks for you"}
          </p>
          <ul className="mt-3 space-y-3">
            {picks.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface/60 px-3 py-2"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.categoryName}</p>
                </div>
                <p className="tabular text-sm font-medium" style={{ color: accent }}>
                  {formatPrice(p.price, menu.currency, menu.locale)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <main className="relative mx-auto max-w-lg px-5 py-10 pb-40">
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
                      className="flex items-start gap-3 border-b border-border/70 pb-5"
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium tracking-tight">
                            {item.name}
                            {safePath && avoid.length > 0 ? (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                                {isTr ? "güvenli" : "safe"}
                              </span>
                            ) : null}
                          </p>
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
                      </div>
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
            <p
              className={`text-center text-xs ${callErr ? "text-danger" : "text-success"}`}
            >
              {callOk || callErr}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={calling}
                onClick={() => void sendNote(c.note)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={calling}
            onClick={() =>
              void sendNote(isTr ? "Garson lütfen" : "Please come to the table")
            }
            style={{ background: accent, color: "#0a0a0b" }}
          >
            <BellRing className="mr-2 h-4 w-4" />
            {calling
              ? isTr
                ? "Gönderiliyor…"
                : "Sending…"
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

      {wizardOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold">
                {isTr ? "Ne yiyebilirim?" : "What can I eat?"}
              </p>
              <button
                type="button"
                className="text-sm text-muted"
                onClick={() => setWizardOpen(false)}
              >
                {isTr ? "Kapat" : "Close"}
              </button>
            </div>

            {wizardStep === 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">
                  {isTr ? "1/3 — Tercih" : "1/3 — Preference"}
                </p>
                {(
                  [
                    ["any", isTr ? "Fark etmez" : "Anything"],
                    ["veg", isTr ? "Vejetaryen" : "Vegetarian"],
                    ["light", isTr ? "Hafif / salata" : "Light / salad"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-accent/50"
                    style={
                      answers.diet === k
                        ? { borderColor: accent, background: `${accent}18` }
                        : undefined
                    }
                    onClick={() => {
                      setAnswers((a) => ({ ...a, diet: k }));
                      setWizardStep(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {wizardStep === 1 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">
                  {isTr ? "2/3 — Baharat" : "2/3 — Spice"}
                </p>
                {(
                  [
                    ["any", isTr ? "Fark etmez" : "Anything"],
                    ["mild", isTr ? "Hafif" : "Mild"],
                    ["bold", isTr ? "Baharatlı" : "Bold"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-accent/50"
                    style={
                      answers.spice === k
                        ? { borderColor: accent, background: `${accent}18` }
                        : undefined
                    }
                    onClick={() => {
                      setAnswers((a) => ({ ...a, spice: k }));
                      setWizardStep(2);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">
                  {isTr ? "3/3 — Bütçe" : "3/3 — Budget"}
                </p>
                {(
                  [
                    ["any", isTr ? "Fark etmez" : "Anything"],
                    ["low", isTr ? "Uygun" : "Budget"],
                    ["mid", isTr ? "Orta" : "Mid"],
                    ["high", isTr ? "Keyif" : "Treat"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-accent/50"
                    style={
                      answers.budget === k
                        ? { borderColor: accent, background: `${accent}18` }
                        : undefined
                    }
                    onClick={() => {
                      setAnswers((a) => ({ ...a, budget: k }));
                      // delay setState then run
                      setTimeout(() => {
                        const result = recommendItems(
                          menu.categories as never,
                          { ...answers, budget: k },
                          avoid,
                          3
                        );
                        setPicks(result);
                        setWizardStep(3);
                      }, 0);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="mt-4 space-y-3">
                {picks && picks.length > 0 ? (
                  picks.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted">{p.categoryName}</p>
                      </div>
                      <p className="tabular text-sm" style={{ color: accent }}>
                        {formatPrice(p.price, menu.currency, menu.locale)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">
                    {isTr
                      ? "Uygun öneri bulunamadı — filtreleri gevşet."
                      : "No matches — try looser filters."}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setWizardStep(0);
                      setPicks(null);
                    }}
                  >
                    {isTr ? "Yeniden" : "Again"}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => setWizardOpen(false)}
                    style={{ background: accent, color: "#0a0a0b" }}
                  >
                    {isTr ? "Menüde göster" : "Show on menu"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
