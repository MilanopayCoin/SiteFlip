"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  RefreshCw,
  Shield,
  Sparkles,
  Store,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BusinessCard } from "@/components/marketplace/business-card";
import { getEnrichedListings } from "@/lib/data/demo";

const LIFECYCLE = [
  "BUILD",
  "GROW",
  "BUY",
  "RENT",
  "REVIVE",
  "SELL",
];

const HOW = [
  {
    icon: Bot,
    title: "Build with AI",
    body: "Generate a business blueprint, brand concept, and starter assets — then take it live.",
  },
  {
    icon: Store,
    title: "Buy or Rent",
    body: "Acquire complete digital businesses — or rent cash-flowing assets without a full purchase.",
  },
  {
    icon: RefreshCw,
    title: "Revive & Grow",
    body: "Find abandoned projects, get an AI revival plan, and become the new operator.",
  },
  {
    icon: Workflow,
    title: "Sell & Reinvest",
    body: "List with AI valuation, transfer ownership, and recycle capital into the next build.",
  },
];

export default function HomePage() {
  const listings = getEnrichedListings();
  const featured = listings.filter((l) => l.featured && l.listing_type !== "REVIVE").slice(0, 3);
  const rentals = listings.filter((l) =>
    ["RENT", "RENT_TO_OWN"].includes(l.listing_type)
  ).slice(0, 3);
  const revive = listings.filter((l) => l.listing_type === "REVIVE").slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="sf-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-4xl text-center"
          >
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
              JIY.APP · AI Business Factory
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
              Turn ideas into
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
                businesses.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg">
              Build with AI, grow, buy, rent, revive, and sell digital businesses —
              across the full lifecycle on jiy.app.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Button size="xl" asChild>
                <Link href="/explore">
                  Explore Businesses <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="secondary" asChild>
                <Link href="/build">Build with AI</Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/revive">Revive a Project</Link>
              </Button>
              <Button size="xl" variant="ghost" asChild>
                <Link href="/sell">Sell Your Business</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-2"
          >
            {LIFECYCLE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                  {step}
                </span>
                {i < LIFECYCLE.length - 1 && (
                  <span className="text-zinc-600">↓</span>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <Section
        title="Featured Businesses"
        subtitle="High AI-score digital assets ready to acquire."
        href="/buy"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((l, i) => (
            <BusinessCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      </Section>

      {/* Rent */}
      <Section
        title="Businesses For Rent"
        subtitle="Operate cash-flowing assets without buying outright — including rent-to-own."
        href="/rent"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rentals.map((l, i) => (
            <BusinessCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      </Section>

      {/* Revive */}
      <Section
        title="Revive Opportunities"
        subtitle="Forgotten digital businesses with AI revival scores."
        href="/revive"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {revive.map((l, i) => (
            <BusinessCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      </Section>

      {/* AI Builder CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Card className="overflow-hidden border-violet-500/20">
          <CardContent className="relative p-8 sm:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-indigo-600/10" />
            <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Business Builder
                </div>
                <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                  Build your next business with AI.
                </h2>
                <p className="mt-3 text-zinc-400">
                  Tell JIY.APP your revenue goal. Get a blueprint, brand
                  concept, landing structure, and growth plan — then start
                  building.
                </p>
                <Button size="lg" className="mt-6" asChild>
                  <Link href="/build">
                    Start Building <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 font-mono text-sm text-zinc-400">
                <p className="text-violet-300">$ jiy build</p>
                <p className="mt-2">
                  → “I want an online business that can make €2,000/month.”
                </p>
                <p className="mt-3 text-zinc-500">Generating blueprint…</p>
                <p className="mt-1 text-emerald-400">✓ Business idea</p>
                <p className="text-emerald-400">✓ Domain ideas</p>
                <p className="text-emerald-400">✓ Pricing & growth plan</p>
                <p className="text-emerald-400">✓ Landing page structure</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* How it works */}
      <Section title="How It Works" subtitle="A digital business is an asset — not just a website.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <item.icon className="h-6 w-6 text-violet-400" />
              <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Trust */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
          <div className="flex items-start gap-4">
            <Shield className="mt-1 h-8 w-8 shrink-0 text-emerald-400" />
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Trust & Verification
              </h2>
              <p className="mt-2 max-w-2xl text-zinc-400">
                JIY.APP never fakes verification, revenue, or transactions.
                Domain ownership verification ships in MVP. Revenue and traffic
                verification interfaces are prepared for Mollie, Shopify, Google
                Analytics, Search Console, PayPal, and Cloudflare.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                AI valuation is informational only and is not financial,
                investment, legal or tax advice. Ordinary Mollie payments are
                not escrow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <Section title="FAQ" subtitle="What makes JIY.APP different.">
        <div className="mx-auto max-w-3xl space-y-4">
          {[
            {
              q: "Is JIY.APP just a website marketplace?",
              a: "No. It is an online business lifecycle platform — build, grow, buy, rent, revive, sell, and reinvest.",
            },
            {
              q: "Can I rent a business instead of buying?",
              a: "Yes. Owners can offer rent and configurable rent-to-own. Contracts are flexible transaction records — not automatic legally binding ownership transfers.",
            },
            {
              q: "Are AI valuations binding?",
              a: "No. They are informational estimates only — not financial, investment, legal, or tax advice.",
            },
            {
              q: "Does AI generate a full production SaaS?",
              a: "No. BUILD generates blueprints and starter assets. External coding services can be connected later.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4"
            >
              <summary className="cursor-pointer list-none font-medium text-white">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-zinc-400">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-zinc-400">{subtitle}</p>
        </div>
        {href && (
          <Button variant="ghost" asChild>
            <Link href={href}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
