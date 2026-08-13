"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Factory, FolderKanban, Eye, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCachedFactoryProjects } from "@/lib/factory/client-cache";

const LAST_PROJECT_KEY = "jiy_last_factory_project_id";

function readLastProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromPath = window.location.pathname.match(
      /^\/build\/([0-9a-f-]{36})/i
    )?.[1];
    if (fromPath) {
      sessionStorage.setItem(LAST_PROJECT_KEY, fromPath);
      return fromPath;
    }
    const stored = sessionStorage.getItem(LAST_PROJECT_KEY);
    if (stored) return stored;
    return listCachedFactoryProjects()[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Mobile-only 4-slot bottom bar: Factory · Proje · Preview · Hesap
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(readLastProjectId());
  }, [pathname]);

  const projectHref = projectId ? `/build/${projectId}` : "/build";
  const previewHref = projectId ? `/build/${projectId}/preview` : "/build";

  const items = [
    {
      href: "/build",
      label: "Factory",
      icon: Factory,
      active:
        pathname === "/build" ||
        (pathname.startsWith("/build") &&
          !pathname.includes("/preview") &&
          pathname.split("/").length <= 2),
    },
    {
      href: projectHref,
      label: "Proje",
      icon: FolderKanban,
      active:
        Boolean(projectId) &&
        pathname.startsWith(`/build/${projectId}`) &&
        !pathname.includes("/preview"),
    },
    {
      href: previewHref,
      label: "Preview",
      icon: Eye,
      active: Boolean(projectId) && pathname.includes("/preview"),
    },
    {
      href: "/profile",
      label: "Hesap",
      icon: UserRound,
      active:
        pathname.startsWith("/profile") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/dashboard"),
    },
  ] as const;

  // Hide on auth-heavy full-bleed pages? Keep visible — Hesap still useful.
  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07070c]/92 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="contents">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors",
                  item.active ? "text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {item.active && (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-violet-400" />
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
