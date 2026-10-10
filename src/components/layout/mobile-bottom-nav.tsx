"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PencilLine, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobile bar — JIY Menu only */
export function MobileBottomNav() {
  const pathname = usePathname();

  const items = [
    {
      href: "/",
      label: "Ana sayfa",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/",
      label: "Oluştur",
      icon: QrCode,
      active: false,
    },
    {
      href: "/qr-menu/edit/last",
      label: "Editör",
      icon: PencilLine,
      active: pathname.startsWith("/qr-menu/edit"),
    },
  ] as const;

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="contents">
              <Link
                href={item.href}
                className={cn(
                  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors",
                  item.active
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                )}
                onClick={(e) => {
                  if (item.label === "Editör") {
                    try {
                      const keys = Object.keys(localStorage).filter((k) =>
                        k.startsWith("jiy-menu-edit-")
                      );
                      if (keys[0]) {
                        const url = localStorage.getItem(keys[0]);
                        if (url) {
                          e.preventDefault();
                          window.location.href = url;
                        }
                      }
                    } catch {
                      // fall through
                    }
                  }
                }}
              >
                {item.active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
                )}
                <Icon
                  className="h-5 w-5"
                  strokeWidth={item.active ? 2.25 : 1.75}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
