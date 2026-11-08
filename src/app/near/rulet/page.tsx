import type { Metadata } from "next";
import { RouletteApp } from "@/components/near/roulette-app";

export const metadata: Metadata = {
  title: "Rulet",
  description:
    "JIY Near görüntülü 3D rulet masası — StarKey, demo chip, commit-reveal spin.",
};

export default function NearRuletPage() {
  return <RouletteApp />;
}
