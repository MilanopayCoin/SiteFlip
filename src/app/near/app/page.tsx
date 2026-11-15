import type { Metadata } from "next";
import { NearApp } from "@/components/near/near-app";

export const metadata: Metadata = {
  title: "Uygulama",
  description: "JIY Near — radar, chat, görüntülü, hediye.",
};

export default function NearAppPage() {
  return <NearApp />;
}
