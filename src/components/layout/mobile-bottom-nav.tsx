"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, Handshake, Store, Tag, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-only 5-slot bottom bar: Marketplace · Deals · Trafik · Sell · Profile
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const items = [
    {
      href: "/marketplace",
      label: "Marketplace",
      icon: Store,
      active:
        pathname === "/marketplace" || pathname.startsWith("/marketplace/"),
    },
    {
      href: "/deals",
      label: "Deals",
      icon: Handshake,
      active: pathname === "/deals" || pathname.startsWith("/deals/"),
    },
    {
      href: "/trafik-studio",
      label: "Trafik",
      icon: CarFront,
      active: pathname.startsWith("/trafik-studio"),
    },
    {
      href: "/sell",
      label: "Sell",
      icon: Tag,
      active: pathname === "/sell" || pathname.startsWith("/sell/"),
    },
    {
      href: "/profile",
      label: "Profile",
      icon: UserRound,
      active:
        pathname.startsWith("/profile") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup"),
    },
  ] as const;

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="contents">
              <Link
                href={item.href}
                className={cn(
                  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors",
                  item.active ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                {item.active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
                )}
                <Icon className="h-5 w-5" strokeWidth={item.active ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
