"use client";

import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <>
      {!isLanding && <SiteHeader />}
      {children}
      {!isLanding && (
        <>
          <SiteFooter />
          <MobileBottomNav />
        </>
      )}
    </>
  );
}
