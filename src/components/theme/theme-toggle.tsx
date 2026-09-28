"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jiy-theme";
const THEME_EVENT = "jiy-theme-change";

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function apply(next: "dark" | "light") {
  const root = document.documentElement;
  if (next === "light") {
    root.setAttribute("data-theme", "light");
    localStorage.setItem(STORAGE_KEY, "light");
  } else {
    root.removeAttribute("data-theme");
    localStorage.setItem(STORAGE_KEY, "dark");
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={cn(
        "jiy-focus-ring inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 text-sm text-foreground transition-colors hover:border-accent/40",
        className
      )}
      onClick={() => apply(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
    >
      {isLight ? (
        <Moon className="h-4 w-4" aria-hidden />
      ) : (
        <Sun className="h-4 w-4" aria-hidden />
      )}
      <span className="hidden sm:inline">{isLight ? "Dark" : "Light"}</span>
    </button>
  );
}
