"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Factory, FolderKanban, CarFront, Eye, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCachedFactoryProjects } from "@/lib/factory/client-cache";

const LAST_PROJECT_KEY = "jiy_last_factory_project_id";

function readLastProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromBuild = window.location.pathname.match(
      /^\/build\/([0-9a-f-]{36})/i
    )?.[1];
    const fromGenerated = window.location.pathname.match(
      /^\/generated\/([0-9a-f-]{36})/i
    )?.[1];
    const fromPath = fromBuild || fromGenerated;
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
 * App bottom bar: Factory · Proje · Trafik · Preview · Hesap
 * Visible on all viewports so Trafik Studio is one tap away.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setProjectId(readLastProjectId());
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const projectHref = projectId ? `/build/${projectId}` : "/build";
  const previewHref = projectId ? `/generated/${projectId}` : "/build";

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
      href: "/trafik-studio",
      label: "Trafik",
      icon: CarFront,
      active: pathname.startsWith("/trafik-studio"),
    },
    {
      href: previewHref,
      label: "Preview",
      icon: Eye,
      active:
        Boolean(projectId) &&
        (pathname.includes("/preview") || pathname.includes("/generated/")),
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

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07070c]/92 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
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
