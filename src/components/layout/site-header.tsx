"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  clearDemoSession,
} from "@/lib/profile/client-cache";
import {
  createBrowserClient,
  resetBrowserClient,
} from "@/lib/supabase/browser";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/deals", label: "Deals" },
  { href: "/trafik-studio", label: "Trafik" },
  { href: "/profile", label: "Profile" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Do not trust local DEMO cache alone — production auth is cookie/session based
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.authenticated) {
          setSignedIn(true);
          setUsername(d.profile?.username ?? null);
        } else {
          setSignedIn(false);
          setUsername(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const supabase = await createBrowserClient();
    if (supabase) await supabase.auth.signOut();
    resetBrowserClient();
    clearDemoSession();
    setSignedIn(false);
    setUsername(null);
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-[11px] font-semibold tracking-wide text-white">
            J
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            JIY
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Button
            size="sm"
            className="ml-2"
            variant={pathname.startsWith("/sell") ? "default" : "default"}
            asChild
          >
            <Link href="/sell">Sell</Link>
          </Button>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile">{username ? `@${username}` : "Account"}</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/signup">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/sell"
              onClick={() => setOpen(false)}
              className="rounded-md bg-slate-900 px-3 py-2.5 text-center text-sm font-medium text-white"
            >
              Sell
            </Link>
            {signedIn ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="mt-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-center text-sm font-medium text-zinc-700"
              >
                Log out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-sm font-medium text-white"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-900 text-[10px] font-semibold text-white">
              J
            </div>
            <span className="text-lg font-semibold text-zinc-900">JIY.APP</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-zinc-500">
            Verified Digital Businesses.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-800">Marketplace</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>
              <Link href="/marketplace?type=BUY" className="hover:text-zinc-800">
                Buy
              </Link>
            </li>
            <li>
              <Link href="/marketplace?type=RENT" className="hover:text-zinc-800">
                Rent
              </Link>
            </li>
            <li>
              <Link href="/marketplace?type=REVIVE" className="hover:text-zinc-800">
                Revive
              </Link>
            </li>
            <li>
              <Link href="/sell" className="hover:text-zinc-800">
                Sell
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-800">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>
              <Link href="/deals" className="hover:text-zinc-800">
                Deals
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-zinc-800">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/trafik-studio" className="hover:text-zinc-800">
                Trafik Studio
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} JIY.APP. Marketplace listings are informational.
      </div>
    </footer>
  );
}
