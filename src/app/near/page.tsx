import type { Metadata } from "next";
import { NearApp } from "@/components/near/near-app";

export const metadata: Metadata = {
  title: "JIY Near",
  description:
    "Yakındakilerle StarKey sohbet, check-in radar ve SUPRA hediyeler.",
};

export default function NearPage() {
  return <NearApp />;
}
