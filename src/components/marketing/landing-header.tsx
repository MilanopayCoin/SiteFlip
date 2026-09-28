"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clearDemoSession } from "@/lib/profile/client-cache";
import {
  createBrowserClient,
  resetBrowserClient,
} from "@/lib/supabase/browser";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/marketplace?type=REVIVE", label: "Revive" },
  { href: "/sell", label: "Sell" },
] as const;

export function LandingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSignedIn(Boolean(d.authenticated));
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
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="jiy-container flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-foreground">
          JIY
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[12px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile">Account</Link>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void logout()}>
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
          type="button"
          className="jiy-focus-ring rounded-[12px] p-2.5 text-muted hover:bg-surface-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Open menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "min-h-11 rounded-[12px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-2"
                )}
              >
                {item.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                <Link
                  href="/profile"
                  className="min-h-11 rounded-[12px] px-3 py-2.5 text-sm"
                  onClick={() => setOpen(false)}
                >
                  Account
                </Link>
                <button
                  type="button"
                  className="min-h-11 rounded-[12px] px-3 py-2.5 text-left text-sm"
                  onClick={() => void logout()}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="min-h-11 rounded-[12px] px-3 py-2.5 text-sm"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="min-h-11 rounded-[12px] bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-ink"
                  onClick={() => setOpen(false)}
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
