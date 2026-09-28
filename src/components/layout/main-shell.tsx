"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <main
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground",
        !isLanding && "min-h-[calc(100vh-8rem)] pb-20 md:pb-0"
      )}
    >
      {children}
    </main>
  );
}
