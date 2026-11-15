import type { Metadata } from "next";
import { RouletteApp } from "@/components/near/roulette-app";

export const metadata: Metadata = {
  title: "Rulet masası",
  description: "JIY Near görüntülü rulet masasına katıl.",
};

export default async function NearRuletTablePage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return <RouletteApp initialTableId={tableId} />;
}
