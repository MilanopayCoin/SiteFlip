"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, Smartphone, Zap } from "lucide-react";
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

export default function QrMenuLandingPage() {
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
              Dijital menü + QR — tamamen ücretsiz.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-4 max-w-md text-base text-muted sm:text-lg"
            >
              Mekan adını yaz, fiyatları düzenle, QR’ı yazdır. Hesap yok.
              Abonelik yok. Sonsuza kadar ücretsiz.
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
                %100 ücretsiz. Genel link + düzenleme linki alırsın — düzenleme
                linkini kimseyle paylaşma.
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                      Canlı menü
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
                      Casa Verde
                    </p>
                    <p className="mt-1 text-sm text-muted">Kahve & mutfak</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <QrCode className="h-14 w-14 text-black" strokeWidth={1.25} />
                  </div>
                </div>

                <div className="mt-10 space-y-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      İçecekler
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                        <div>
                          <p className="font-medium">Latte</p>
                          <p className="text-xs text-muted">Espresso, süt</p>
                        </div>
                        <p className="tabular font-medium text-accent">₺120</p>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                        <div>
                          <p className="font-medium">Çay</p>
                          <p className="text-xs text-muted">Demlik</p>
                        </div>
                        <p className="tabular font-medium text-accent">₺40</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Mutfak
                    </p>
                    <div className="mt-3 flex items-baseline justify-between gap-4 border-b border-border/80 pb-3">
                      <div>
                        <p className="font-medium">Karışık tost</p>
                        <p className="text-xs text-muted">Kaşar · Gluten</p>
                      </div>
                      <p className="tabular font-medium text-accent">₺180</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-8 text-xs text-muted">
                  <Smartphone className="h-3.5 w-3.5" />
                  Telefonda açılır — uygulama yok
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
              title: "1 dakikada yayında",
              body: "Mekan adını yaz. Örnek yemekleri düzenle. Linki paylaş.",
            },
            {
              icon: QrCode,
              title: "QR hemen hazır",
              body: "Masa ve vitrin için temiz SVG / PNG QR indir.",
            },
            {
              icon: Smartphone,
              title: "Misafir sadece okutur",
              body: "Hızlı mobil menü. Fiyatı anında güncelle — yeniden baskı yok.",
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
