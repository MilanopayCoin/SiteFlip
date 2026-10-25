"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VenuePlacePicker,
  type VenueSelection,
} from "@/components/qr-menu/venue-place-picker";
import { MENU_MARKETS, type MenuMarket } from "@/lib/places/markets";

export default function QrMenuLandingPage() {
  const router = useRouter();
  const [market, setMarket] = useState<MenuMarket>("nl");
  const [name, setName] = useState("");
  const [selection, setSelection] = useState<VenueSelection | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(MENU_MARKETS[market].defaultCurrency);
  }, [market]);

  async function createMenu(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        name: selection?.name?.trim() || name.trim(),
        tagline: selection?.tagline || undefined,
        currency,
        market,
        venue: selection?.venue ?? undefined,
      };
      const res = await fetch("/api/qr-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create menu");

      const { id, editToken, slug } = data.menu;
      try {
        localStorage.setItem(`jiy-menu-${id}`, editToken);
        localStorage.setItem(`jiy-menu-slug-${id}`, slug);
      } catch {
        // ignore
      }
      router.push(
        `/qr-menu/edit/${encodeURIComponent(id)}?token=${encodeURIComponent(editToken)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
      {/* Atmospheric plane */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_80%,color-mix(in_srgb,var(--foreground)_6%,transparent),transparent_50%)]" />
        <div className="sf-grid absolute inset-0 opacity-30" />
      </div>

      <section className="relative">
        <div className="jiy-container grid min-h-[100dvh] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="font-display text-4xl font-semibold tracking-tight text-accent sm:text-5xl md:text-6xl"
            >
              JIY Menu
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="mt-4 max-w-xl text-2xl font-medium tracking-tight text-foreground sm:text-3xl md:text-[2rem] md:leading-snug"
            >
              Digital menu + QR — free forever.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-4 max-w-md text-base text-muted sm:text-lg"
            >
              Name your venue, edit prices in seconds, print the QR. No account.
              No subscription.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24 }}
              onSubmit={createMenu}
              className="mt-10 max-w-md space-y-4"
            >
              <div className="space-y-2">
                <Label>
                  {market === "tr" ? "Pazar" : "Markt"}
                </Label>
                <div className="flex gap-2">
                  {(Object.keys(MENU_MARKETS) as MenuMarket[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMarket(id)}
                      className={`h-11 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                        market === id
                          ? "border-accent bg-accent/15 text-foreground"
                          : "border-border bg-surface text-muted hover:border-border/80"
                      }`}
                    >
                      {MENU_MARKETS[id].label}
                    </button>
                  ))}
                </div>
              </div>
              <VenuePlacePicker
                market={market}
                name={name}
                onNameChange={setName}
                onSelectionChange={setSelection}
              />
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12">
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
              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base"
                disabled={loading || name.trim().length < 2}
              >
                {loading ? "Creating…" : "Create free menu"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-muted">
                100% free. You get a public link and an edit link — keep the edit
                link private.
              </p>
            </motion.form>
          </div>

          {/* Dominant visual: phone menu + QR plane */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
            aria-hidden
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]">
              <div className="absolute inset-0 bg-gradient-to-b from-surface-2 via-surface to-background" />
              <div className="relative flex h-full flex-col px-6 pb-8 pt-8 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                      Live menu
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
                      Casa Verde
                    </p>
                    <p className="mt-1 text-sm text-muted">Kitchen & coffee</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <QrCode className="h-14 w-14 text-black" strokeWidth={1.25} />
                  </div>
                </div>

                <div className="mt-10 space-y-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Drinks
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                        <div>
                          <p className="font-medium">Caffe Latte</p>
                          <p className="text-xs text-muted">Espresso, steamed milk</p>
                        </div>
                        <p className="tabular font-medium text-accent">€3.80</p>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                        <div>
                          <p className="font-medium">Espresso</p>
                          <p className="text-xs text-muted">Single shot</p>
                        </div>
                        <p className="tabular font-medium text-accent">€2.50</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Kitchen
                    </p>
                    <div className="mt-3 flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                      <div>
                        <p className="font-medium">Avocado toast</p>
                        <p className="text-xs text-muted">Sourdough · Gluten</p>
                      </div>
                      <p className="tabular font-medium text-accent">€9.50</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-8 text-xs text-muted">
                  <Smartphone className="h-3.5 w-3.5" />
                  Opens on every phone — no app
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative border-t border-border py-16 sm:py-20">
        <div className="jiy-container grid gap-10 sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Live in under a minute",
              body: "Type the venue name. Edit sample dishes. Share the link.",
            },
            {
              icon: QrCode,
              title: "QR ready to print",
              body: "Download a clean SVG QR for tables, windows, and takeaway.",
            },
            {
              icon: Smartphone,
              title: "Guests just scan",
              body: "Fast mobile menu. Update prices anytime — no reprinting.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <item.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
