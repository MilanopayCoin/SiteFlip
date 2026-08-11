"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/buy", label: "Buy" },
  { href: "/rent", label: "Rent" },
  { href: "/build", label: "Build" },
  { href: "/revive", label: "Revive" },
  { href: "/sell", label: "Sell" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07070c]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            SITE<span className="text-violet-400">FLIP</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>

        <button
          className="md:hidden rounded-lg p-2 text-zinc-300 hover:bg-white/5"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-[#07070c] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-violet-600 px-3 py-2.5 text-center text-sm font-medium text-white"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#050508]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-lg font-semibold text-white">SITEFLIP</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-zinc-500">
            The operating system for digital business acquisitions. Build. Buy.
            Rent. Revive. Grow. Sell.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">Marketplace</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li><Link href="/buy" className="hover:text-zinc-300">Buy</Link></li>
            <li><Link href="/rent" className="hover:text-zinc-300">Rent</Link></li>
            <li><Link href="/revive" className="hover:text-zinc-300">Revive</Link></li>
            <li><Link href="/sell" className="hover:text-zinc-300">Sell</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">Platform</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li><Link href="/build" className="hover:text-zinc-300">Build with AI</Link></li>
            <li><Link href="/find" className="hover:text-zinc-300">Find My Business</Link></li>
            <li><Link href="/dashboard" className="hover:text-zinc-300">Dashboard</Link></li>
            <li><Link href="/admin" className="hover:text-zinc-300">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} SITEFLIP. AI valuations are informational only.
      </div>
    </footer>
  );
}
