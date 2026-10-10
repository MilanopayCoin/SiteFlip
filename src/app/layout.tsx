import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { SiteChrome } from "@/components/layout/site-chrome";
import { MainShell } from "@/components/layout/main-shell";
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
    default: "JIY Menu — Ücretsiz akıllı QR menü",
    template: "%s · JIY Menu",
  },
  description:
    "Ücretsiz dijital menü + QR. Alerjen lens, masa QR, garson çağır, günün spesiyali. Hesap yok.",
  keywords: [
    "qr menü",
    "dijital menü",
    "ücretsiz qr menu",
    "restoran menü",
    "alerjen menü",
    "garson çağır",
  ],
  metadataBase: new URL("https://jiy.app"),
  openGraph: {
    type: "website",
    siteName: "JIY Menu",
  },
  twitter: {
    card: "summary_large_image",
  },
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
        <SiteChrome>
          <MainShell>{children}</MainShell>
        </SiteChrome>
      </body>
    </html>
  );
}
