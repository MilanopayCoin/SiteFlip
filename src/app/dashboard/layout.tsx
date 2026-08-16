import Link from "next/link";
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
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: Bot },
  { href: "/build", label: "Business Factory", icon: Bot },
  { href: "/dashboard/businesses", label: "My Businesses", icon: Building2 },
  { href: "/dashboard/listings", label: "My Listings", icon: ListOrdered },
  { href: "/dashboard/rentals", label: "My Rentals", icon: KeyRound },
  { href: "/dashboard/offers", label: "My Offers", icon: Handshake },
  { href: "/dashboard/watchlist", label: "My Watchlist", icon: Eye },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/ai", label: "AI Command Center", icon: Bot },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Dashboard
        </p>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300"
            >
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
