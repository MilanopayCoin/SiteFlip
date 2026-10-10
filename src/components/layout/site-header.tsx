"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const NAV = [
  { href: "/", label: "Ana sayfa", exact: true },
  { href: "/#benzersiz", label: "Özellikler", exact: false },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="jiy-container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-accent text-[11px] font-semibold tracking-wide text-accent-ink">
            J
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
            JIY Menu
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                item.exact
                  ? pathname === "/"
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Button size="sm" className="ml-2" asChild>
            <Link href="/">Ücretsiz oluştur</Link>
          </Button>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
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
              href="/"
              onClick={() => setOpen(false)}
              className="rounded-[12px] bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-ink"
            >
              Ücretsiz oluştur
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="jiy-container flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-foreground">JIY Menu</span>
          {" · "}
          Dijital menü + QR — ücretsiz
        </p>
        <p className="text-xs">Alerjen lens · Masa QR · Garson · Spesiyal</p>
      </div>
    </footer>
  );
}
