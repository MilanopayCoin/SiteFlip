import type { Metadata } from "next";
import { MatchBetsApp } from "@/components/near/match-bets-app";

export const metadata: Metadata = {
  title: "Outcomes · Bahis",
  description:
    "JIY Outcomes — TipsAudit fair odds, OKX-style markets, betslip, positions. SUPRA + JIY 1X2.",
}

export default function NearBahisPage() {
  return <MatchBetsApp />;
}
