import type { Metadata } from "next";
import { Syne, Manrope } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-near-display",
  weight: ["500", "600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-near-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "JIY Near",
    template: "%s · JIY Near",
  },
  description:
    "Şu an yakınındakilerle StarKey sohbet, görüntülü ve SUPRA hediyeler. Ephemeral radar — kaçırırsan yok.",
  openGraph: {
    title: "JIY Near",
    description:
      "Yakınlık ekonomisi: check-in, chat, görüntülü, zincir üstü hediye.",
  },
};

export default function NearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${syne.variable} ${manrope.variable}`}
      style={
        {
          ["--font-display" as string]: "var(--font-near-display)",
          ["--font-sans" as string]: "var(--font-near-body)",
          fontFamily: "var(--font-near-body), ui-sans-serif, system-ui",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
