import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, Geist_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JIY.APP — Verified Digital Businesses",
    template: "%s · JIY.APP",
  },
  description:
    "JIY.APP marketplace — buy, rent, revive, and sell verified digital businesses.",
  keywords: [
    "digital business marketplace",
    "buy saas",
    "rent website",
    "revive abandoned project",
    "sell online business",
    "verified digital businesses",
  ],
  metadataBase: new URL("https://jiy.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${instrument.variable} ${geistMono.variable} antialiased sf-glow`}
      >
        <SiteHeader />
        <main className="min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full overflow-x-hidden pb-20 md:pb-0">
          {children}
        </main>
        <SiteFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
