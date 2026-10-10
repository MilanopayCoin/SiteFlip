"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Filter,
  QrCode,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createMenu(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/qr-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, locale: "tr" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Menü oluşturulamadı");

      const { id, editToken, slug } = data.menu;
      try {
        localStorage.setItem(`jiy-menu-${id}`, editToken);
        localStorage.setItem(`jiy-menu-slug-${id}`, slug);
        localStorage.setItem(
          `jiy-menu-edit-${id}`,
          `${window.location.origin}/qr-menu/edit/${id}?token=${editToken}`
        );
      } catch {
        // ignore
      }
      router.push(
        `/qr-menu/edit/${encodeURIComponent(id)}?token=${encodeURIComponent(editToken)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
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
              Akıllı QR menü — tamamen ücretsiz.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-4 max-w-md text-base text-muted sm:text-lg"
            >
              Alerjen lens, masa QR, garson çağır, günün spesiyali. Hesap yok.
              Abonelik yok.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24 }}
              onSubmit={createMenu}
              className="mt-10 max-w-md space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="venue">Mekan adı</Label>
                <Input
                  id="venue"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn. Casa Verde"
                  className="h-12 text-base"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Para birimi</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12">
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
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base"
                disabled={loading || name.trim().length < 2}
              >
                {loading ? "Oluşturuluyor…" : "Ücretsiz menü oluştur"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-muted">
                %100 ücretsiz. Düzenleme linkini sakla — kimseyle paylaşma.
              </p>
            </motion.form>
          </div>

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
                <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                    Günün spesiyali
                  </p>
                  <p className="mt-1 text-sm font-medium">Fırınlanmış somon · ₺420</p>
                </div>
                <div className="mt-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl font-semibold tracking-tight">
                      Casa Verde
                    </p>
                    <p className="mt-1 text-sm text-muted">Masa 7 · Kahve & mutfak</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <QrCode className="h-12 w-12 text-black" strokeWidth={1.25} />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-ink">
                    − Süt
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted">
                    Gluten
                  </span>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between border-b border-border/80 pb-3">
                    <div>
                      <p className="font-medium">Çay</p>
                      <p className="text-xs text-muted">Alerjen yok</p>
                    </div>
                    <p className="tabular text-accent">₺40</p>
                  </div>
                  <div className="flex justify-between border-b border-border/80 pb-3 opacity-40">
                    <div>
                      <p className="font-medium line-through">Latte</p>
                      <p className="text-xs text-muted">Lens ile gizlendi</p>
                    </div>
                    <p className="tabular">₺120</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-3 text-sm font-medium">
                  <BellRing className="h-4 w-4 text-accent" />
                  Garson çağır · Masa 7
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="benzersiz" className="relative border-t border-border py-16 sm:py-20">
        <div className="jiy-container">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Benzersiz
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Sıradan QR menü değil
          </h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              {
                icon: Filter,
                title: "Alerjen lens",
                body: "Misafir Süt / Gluten seçer — riskli ürünler anında gizlenir.",
              },
              {
                icon: BellRing,
                title: "Masa QR + garson",
                body: "Her masaya ayrı QR. Tek dokunuşla garson çağrısı editöre düşer.",
              },
              {
                icon: Sparkles,
                title: "Günün spesiyali",
                body: "Üst şeritte öne çıkan ürün — süre bitince otomatik kaybolur.",
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
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-border py-14">
        <div className="jiy-container flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Smartphone className="h-4 w-4 text-accent" />
            Uygulama indirmeden — tarayıcıda açılır
          </div>
          <p className="text-sm text-muted">JIY Menu · forever free</p>
        </div>
      </section>
    </div>
  );
}
