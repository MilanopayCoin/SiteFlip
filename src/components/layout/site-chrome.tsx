"use client";

import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  /** Guest-facing digital menu — no marketplace chrome */
  const isPublicMenu = pathname === "/m" || pathname.startsWith("/m/");
  /** JIY Near — immersive proximity social */
  const isNear = pathname === "/near" || pathname.startsWith("/near/");
  const bare = isLanding || isPublicMenu || isNear;

  return (
    <>
      {!bare && <SiteHeader />}
      {children}
      {!bare && (
        <>
          <SiteFooter />
          <MobileBottomNav />
        </>
      )}
    </>
  );
}
