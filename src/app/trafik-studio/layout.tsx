import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trafik Studio",
  description:
    "Trafik teorisi senaryosunu koruyarak görseli yeniden üretin.",
};

export default function TrafikStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
