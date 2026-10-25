import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chrono Forge — Zamanın Demircisi",
  description:
    "JIY.APP oyun konsept demosu: Zaman katmanları, Forge metrem ve Amusnet esintili slot mekaniği (demo).",
};

export default function ChronoForgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
