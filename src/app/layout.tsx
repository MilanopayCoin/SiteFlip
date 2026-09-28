import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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

const themeInitScript = `(function(){try{var t=localStorage.getItem('jiy-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${GeistSans.variable} ${inter.variable} ${geistMono.variable} antialiased`}
      >
        <SiteHeader />
        <main className="min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full overflow-x-hidden bg-background pb-20 text-foreground md:pb-0">
          {children}
        </main>
        <SiteFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
