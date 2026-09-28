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
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="jiy-container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-accent text-[11px] font-semibold tracking-wide text-accent-ink">
            J
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
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
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
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
              <Button size="sm" asChild>
                <Link href="/signup">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="jiy-focus-ring rounded-[12px] p-2.5 text-muted hover:bg-surface-2 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-[12px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-2"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/sell"
              onClick={() => setOpen(false)}
              className="rounded-[12px] bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-ink"
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
                className="mt-2 rounded-[12px] border border-border px-3 py-2.5 text-center text-sm font-medium text-foreground"
              >
                Log out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-[12px] px-3 py-2.5 text-center text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-[12px] bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-ink"
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
    <footer className="border-t border-border bg-surface">
      <div className="jiy-container grid gap-8 py-12 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[12px] border border-border bg-accent text-[10px] font-semibold text-accent-ink">
              J
            </div>
            <span className="font-display text-lg font-semibold text-foreground">
              JIY.APP
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-muted">
            Verified Digital Businesses.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Marketplace</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/marketplace?type=BUY" className="hover:text-accent">
                Buy
              </Link>
            </li>
            <li>
              <Link href="/marketplace?type=RENT" className="hover:text-accent">
                Rent
              </Link>
            </li>
            <li>
              <Link href="/marketplace?type=REVIVE" className="hover:text-accent">
                Revive
              </Link>
            </li>
            <li>
              <Link href="/sell" className="hover:text-accent">
                Sell
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/deals" className="hover:text-accent">
                Deals
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-accent">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/trafik-studio" className="hover:text-accent">
                Trafik Studio
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="jiy-container flex flex-col items-center justify-between gap-4 py-4 sm:flex-row">
          <p className="text-center text-xs text-muted sm:text-left">
            © {new Date().getFullYear()} JIY.APP. Marketplace listings are
            informational.
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
