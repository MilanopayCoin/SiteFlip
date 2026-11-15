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
    default: "JIY Outcomes",
    template: "%s · JIY Outcomes",
  },
  description:
    "JIY Outcomes — OKX-style sports markets, fair odds, betslip & positions. SUPRA + JIY. Near sosyal yanında.",
  openGraph: {
    title: "JIY Outcomes",
    description:
      "Fair odds 1X2 markets · StarKey · SUPRA ledger + Move JIY. Near live social.",
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
