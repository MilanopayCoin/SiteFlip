import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JIY.APP — Turn ideas into businesses.",
    template: "%s · JIY.APP",
  },
  description:
    "JIY.APP — AI Business Factory. BUILD → GROW → BUY → RENT → REVIVE → SELL.",
  keywords: [
    "AI business factory",
    "build saas with AI",
    "digital business marketplace",
    "buy saas",
    "rent website",
    "revive abandoned project",
  ],
  metadataBase: new URL("https://jiy.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased sf-glow`}
      >
        <SiteHeader />
        <main className="min-h-[calc(100vh-8rem)]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
