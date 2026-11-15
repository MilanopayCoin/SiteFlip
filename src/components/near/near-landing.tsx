"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChartColumn, Radio, Gift } from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function NearLanding() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#070708] text-[#f2f2f0]">
      {/* Full-bleed atmosphere — outcomes market night */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 75% at 72% 12%, rgba(0,212,170,0.18), transparent 55%), radial-gradient(ellipse 55% 45% at 12% 88%, rgba(212,255,58,0.07), transparent 50%), linear-gradient(180deg, #070708 0%, #0b0d0c 45%, #070708 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cpath d='M0 70h140M70 0v140' stroke='%23ffffff' stroke-opacity='0.035' stroke-width='1'/%3E%3Cpath d='M20 110 L70 30 L120 110' fill='none' stroke='%2300d4aa' stroke-opacity='0.08' stroke-width='1.2'/%3E%3C/svg%3E\")",
            backgroundSize: "140px 140px",
          }}
        />
        <motion.div
          className="absolute right-[-8%] top-[18%] h-[min(58vw,380px)] w-[min(58vw,380px)] rounded-full border border-[#00d4aa]/25"
          animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.18, 0.4] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[6%] top-[28%] h-[min(28vw,180px)] w-[min(28vw,180px)] rounded-full border border-[#00d4aa]/4"
          animate={{ scale: [1.04, 0.96, 1.04], opacity: [0.55, 0.28, 0.55] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[18%] top-[34%] h-2.5 w-2.5 rounded-full bg-[#00d4aa] shadow-[0_0_28px_rgba(0,212,170,0.85)]"
          animate={{ opacity: [1, 0.35, 1], scale: [1, 0.8, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <p
          className="text-lg font-semibold tracking-tight text-[#00d4aa]"
          style={{ fontFamily: "var(--font-near-display), sans-serif" }}
        >
          JIY Outcomes
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/near/bahis"
            className="text-sm font-medium text-[#00d4aa] transition-colors hover:text-[#5eead4]"
          >
            Markets
          </Link>
          <Link
            href="/near/rulet"
            className="text-sm text-[#a1a1aa] transition-colors hover:text-[#f2f2f0]"
          >
            Rulet
          </Link>
          <Link
            href="/near/app"
            className="text-sm text-[#a1a1aa] transition-colors hover:text-[#f2f2f0]"
          >
            Near
          </Link>
        </div>
      </header>

      {/* Hero — Outcomes first: brand, headline, line, CTAs */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-6xl flex-col justify-end px-5 pb-16 pt-10 sm:px-8 sm:pb-24 lg:justify-center lg:pb-20">
        <div className="max-w-2xl">
          <motion.p
            {...fade}
            transition={{ duration: 0.55 }}
            className="text-[clamp(3rem,11vw,6.5rem)] font-extrabold leading-[0.92] tracking-[-0.04em] text-[#00d4aa]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            JIY Outcomes
          </motion.p>
          <motion.h1
            {...fade}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mt-6 max-w-xl text-[clamp(1.35rem,3.5vw,1.9rem)] font-medium leading-snug tracking-tight text-[#f2f2f0]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Fair odds. Market fill. SUPRA + JIY ile 1X2 trade.
          </motion.h1>
          <motion.p
            {...fade}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-4 max-w-md text-base leading-relaxed text-[#9ca3af] sm:text-lg"
          >
            TipsAudit devigged oranlar · OKX Outcomes tarzı betslip, pozisyonlar
            ve settlement. StarKey ile bağlan — playbook gibi değil, canlı
            market.
          </motion.p>
          <motion.div
            {...fade}
            transition={{ duration: 0.55, delay: 0.32 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/near/bahis"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#00d4aa] px-7 text-sm font-semibold text-[#04110e] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Markets’e gir
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/near/app"
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm text-[#d4d4d8] transition-colors hover:border-white/30 hover:text-white"
            >
              Near sosyal
            </Link>
          </motion.div>
        </div>
      </section>

      {/* One job: what you trade */}
      <section
        id="markets"
        className="relative z-10 border-t border-white/8 bg-[#0a0a0b]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p
            className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00d4aa]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Outcomes
          </p>
          <h2
            className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Ligler. Oranlar. Pozisyon.
          </h2>
          <p className="mt-3 max-w-lg text-[#9ca3af]">
            Events · Soon · Today. Tek seçim veya multi slip. Settle ile
            InferSports sonucu.
          </p>

          <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                icon: ChartColumn,
                title: "Markets",
                body: "League chip’ler, probability bar, 1 / X / 2 market fill — OKX Outcomes ritmi.",
              },
              {
                icon: Gift,
                title: "SUPRA + JIY",
                body: "Sosyal ledger SUPRA chips veya Move FA JIY treasury — aynı betslip.",
              },
              {
                icon: Radio,
                title: "Near live",
                body: "Sesli oda, hediye, rulet — Outcomes’un yanında yakınlık döngüsü.",
              },
            ].map((item, i) => (
              <motion.li
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="border-t border-white/10 pt-6"
              >
                <item.icon className="h-5 w-5 text-[#00d4aa]" />
                <p
                  className="mt-4 text-xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-near-display), sans-serif" }}
                >
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {item.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* One job: why StarKey */}
      <section className="relative z-10 border-t border-white/8">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00d4aa]"
              style={{ fontFamily: "var(--font-near-display), sans-serif" }}
            >
              Supra · StarKey
            </p>
            <h2
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-near-display), sans-serif" }}
            >
              Cüzdan kimliğin. Market emrin.
            </h2>
            <p className="mt-4 max-w-md text-[#9ca3af]">
              StarKey personal_sign ile oturum. JIY bahis Move mainnet’te
              doğrulanır; SUPRA ledger’da akar. Gece pot’u Outcomes’tan ayrı
              çekiliş.
            </p>
          </div>
          <div className="relative overflow-hidden border border-white/10 bg-[#121214] p-8 sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
              Trade loop
            </p>
            <ul className="mt-6 space-y-4 text-sm">
              {[
                "StarKey → session",
                "Fair odds → house fill (~4%)",
                "Betslip → SUPRA ledger / JIY Move",
                "Settle → InferSports 1X2",
              ].map((line) => (
                <li
                  key={line}
                  className="flex gap-3 border-b border-white/6 pb-3 font-mono text-[13px] text-[#d4d4d8]"
                >
                  <span className="text-[#00d4aa]">→</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA — Outcomes */}
      <section className="relative z-10 border-t border-white/8">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <p
            className="text-[clamp(2rem,6vw,3.5rem)] font-bold leading-tight tracking-tight text-[#f2f2f0]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Markets açık.
          </p>
          <Link
            href="/near/bahis"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#00d4aa] px-7 text-sm font-semibold text-[#04110e]"
          >
            Outcomes’a gir
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-xs text-[#71717a]">
            jiy.app · StarKey · TipsAudit · Supra Move · Near sosyal
          </p>
        </div>
      </section>
    </div>
  );
}
