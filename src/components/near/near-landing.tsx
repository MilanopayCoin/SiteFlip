"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Gift, Video } from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function NearLanding() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#070708] text-[#f2f2f0]">
      {/* Full-bleed atmosphere — radar / city night, not a card */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 70% 15%, rgba(212,255,58,0.16), transparent 55%), radial-gradient(ellipse 60% 50% at 15% 85%, rgba(56,189,248,0.08), transparent 50%), linear-gradient(180deg, #070708 0%, #0c0c0e 45%, #070708 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cpath d='M0 60h120M60 0v120' stroke='%23ffffff' stroke-opacity='0.04' stroke-width='1'/%3E%3Ccircle cx='60' cy='60' r='28' fill='none' stroke='%23d4ff3a' stroke-opacity='0.07' stroke-width='1'/%3E%3Ccircle cx='60' cy='60' r='52' fill='none' stroke='%23ffffff' stroke-opacity='0.04' stroke-width='1'/%3E%3C/svg%3E\")",
            backgroundSize: "120px 120px",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-[38%] h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d4ff3a]/20"
          animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.15, 0.35] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-[38%] h-[min(42vw,250px)] w-[min(42vw,250px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d4ff3a]/35"
          animate={{ scale: [1.05, 0.95, 1.05], opacity: [0.5, 0.25, 0.5] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[calc(50%+min(18vw,110px))] top-[calc(38%-min(12vw,70px))] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4ff3a] shadow-[0_0_24px_rgba(212,255,58,0.8)]"
          animate={{ opacity: [1, 0.4, 1], scale: [1, 0.85, 1] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <p
          className="text-lg font-semibold tracking-tight text-[#d4ff3a]"
          style={{ fontFamily: "var(--font-near-display), sans-serif" }}
        >
          JIY Near
        </p>
        <Link
          href="/near/app"
          className="text-sm text-[#a1a1aa] transition-colors hover:text-[#f2f2f0]"
        >
          Uygulamaya gir
        </Link>
      </header>

      {/* Hero — one composition: brand, headline, line, CTA */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-6xl flex-col justify-end px-5 pb-16 pt-10 sm:px-8 sm:pb-24 lg:justify-center lg:pb-20">
        <div className="max-w-2xl">
          <motion.p
            {...fade}
            transition={{ duration: 0.55 }}
            className="text-[clamp(3.25rem,12vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.04em] text-[#d4ff3a]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            JIY Near
          </motion.p>
          <motion.h1
            {...fade}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mt-6 max-w-lg text-[clamp(1.35rem,3.5vw,1.85rem)] font-medium leading-snug tracking-tight text-[#f2f2f0]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Şu an yanındaki insanlarla buluş — cüzdanın kimliğin.
          </motion.h1>
          <motion.p
            {...fade}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-4 max-w-md text-base leading-relaxed text-[#9ca3af] sm:text-lg"
          >
            Ephemeral radar, StarKey chat, görüntülü ve SUPRA hediyeler. Kaçırınca
            kaybolur — bu yüzden şimdi.
          </motion.p>
          <motion.div
            {...fade}
            transition={{ duration: 0.55, delay: 0.32 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/near/app"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#d4ff3a] px-7 text-sm font-semibold text-[#0a0a0b] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              StarKey ile aç
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#nasil"
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm text-[#d4d4d8] transition-colors hover:border-white/30 hover:text-white"
            >
              Nasıl çalışır
            </a>
          </motion.div>
        </div>
      </section>

      {/* One job: loop */}
      <section
        id="nasil"
        className="relative z-10 border-t border-white/8 bg-[#0a0a0b]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p
            className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4ff3a]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Döngü
          </p>
          <h2
            className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Check-in. Görün. Bağlan.
          </h2>
          <p className="mt-3 max-w-lg text-[#9ca3af]">
            Üç adım — kalıcı profil spam’i yok. Sadece buradasın diyorsan
            görünürsün.
          </p>

          <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                icon: Radio,
                title: "Radar",
                body: "Konumunu kaba geohash ile aç. 45 dakika — sonra düşersin.",
              },
              {
                icon: Video,
                title: "Canlı",
                body: "Chat veya görüntülü. StarKey imzası olmadan odaya girilmez.",
              },
              {
                icon: Gift,
                title: "Hediye",
                body: "Selam, Boost, Spotlight — SUPRA ile. Yer kasasına da bırak.",
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
                <item.icon className="h-5 w-5 text-[#d4ff3a]" />
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
              className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4ff3a]"
              style={{ fontFamily: "var(--font-near-display), sans-serif" }}
            >
              Supra · StarKey
            </p>
            <h2
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-near-display), sans-serif" }}
            >
              Sahte hesap pahalı. Dikkat gerçek.
            </h2>
            <p className="mt-4 max-w-md text-[#9ca3af]">
              Kimlik cüzdan. Hediye zincirde. Yer kasası bölgeye birikir —
              gece çekilişiyle geri döner. Web2 “swipe” değil; yakınlık ekonomisi.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-none border border-white/10 bg-[#121214] p-8 sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
              Live loop
            </p>
            <ul className="mt-6 space-y-4 text-sm">
              {[
                "StarKey personal_sign → oturum",
                "Check-in → ephemeral presence",
                "Gift / pot → SupraEVM SUPRA",
                "Görüntülü → WebRTC + imzalı sinyal",
              ].map((line) => (
                <li
                  key={line}
                  className="flex gap-3 border-b border-white/6 pb-3 font-mono text-[13px] text-[#d4d4d8]"
                >
                  <span className="text-[#d4ff3a]">→</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 border-t border-white/8">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <p
            className="text-[clamp(2rem,6vw,3.5rem)] font-bold leading-tight tracking-tight text-[#f2f2f0]"
            style={{ fontFamily: "var(--font-near-display), sans-serif" }}
          >
            Şimdi yakında ol.
          </p>
          <Link
            href="/near/app"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#d4ff3a] px-7 text-sm font-semibold text-[#0a0a0b]"
          >
            Uygulamayı aç
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-xs text-[#71717a]">
            jiy.app · StarKey · Supra Devnet
          </p>
        </div>
      </section>
    </div>
  );
}
