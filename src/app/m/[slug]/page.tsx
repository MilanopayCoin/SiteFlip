import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenuBySlug } from "@/lib/qr-menu/store";
import { DEFAULT_ACCENT, publicMenuView } from "@/lib/qr-menu/types";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await ensureCloudflareEnv();
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu || !menu.published) {
    return { title: "Menü · JIY" };
  }
  return {
    title: `${menu.name} · Menü`,
    description: menu.tagline || `${menu.name} dijital menü`,
  };
}

export default async function PublicMenuPage({ params }: Props) {
  await ensureCloudflareEnv();
  const { slug } = await params;
  const raw = await getMenuBySlug(slug);
  if (!raw || !raw.published) notFound();
  const menu = publicMenuView(raw);
  const accent = menu.accentColor || DEFAULT_ACCENT;
  const isTr = menu.locale !== "en";

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

      <main className="relative mx-auto max-w-lg px-5 py-10 pb-24">
        {menu.categories.length === 0 ||
        menu.categories.every((c) => c.items.length === 0) ? (
          <p className="text-center text-sm text-muted">
            {isTr ? "Menü hazırlanıyor." : "This menu is being prepared."}
          </p>
        ) : (
          <div className="space-y-12">
            {menu.categories.map((cat) =>
              cat.items.length === 0 ? null : (
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
                          <p className="font-medium tracking-tight">
                            {item.name}
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
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}
          </div>
        )}
      </main>

      <footer className="relative border-t border-border/80 py-6 text-center">
        <p className="text-xs text-muted">
          {isTr ? "Ücretsiz menü · " : "Free menu by "}
          <Link
            href="/qr-menu"
            className="hover:underline"
            style={{ color: accent }}
          >
            JIY Menu
          </Link>
        </p>
      </footer>
    </div>
  );
}
