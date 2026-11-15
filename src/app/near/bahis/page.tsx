import type { Metadata } from "next";
import { MatchBetsApp } from "@/components/near/match-bets-app";

export const metadata: Metadata = {
  title: "Bahis",
  description:
    "JIY Near maç bahis — ücretsiz TipsAudit oranları, SUPRA + JIY ile 1X2.",
};

export default function NearBahisPage() {
  return <MatchBetsApp />;
}
