"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ListOrdered,
  KeyRound,
  Handshake,
  Eye,
  MessageSquare,
  BarChart3,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: BarChart3, exact: true },
  { href: "/profile", label: "Profile", icon: Bot },
  { href: "/dashboard/businesses", label: "My Businesses", icon: Building2 },
  { href: "/dashboard/listings", label: "My Listings", icon: ListOrdered },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/dashboard/rentals", label: "My Rentals", icon: KeyRound },
  { href: "/dashboard/offers", label: "My Offers", icon: Handshake },
  { href: "/dashboard/watchlist", label: "My Watchlist", icon: Eye },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/ai", label: "AI Command Center", icon: Bot },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 md:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "jiy-focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-surface text-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <p className="sf-label mb-3">Workspace</p>
      <nav className="space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "jiy-focus-ring flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
