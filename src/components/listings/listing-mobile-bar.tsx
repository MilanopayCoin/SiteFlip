"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Button } from "@/components/ui/button";

export function ListingMobileBar({
  priceLabel,
  price,
  currency,
  verified,
  actionsAnchorId = "listing-actions",
}: {
  priceLabel: string;
  price: number | null | undefined;
  currency: string;
  verified: boolean;
  actionsAnchorId?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-[3.75rem] z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted">
            {priceLabel}
          </p>
          <p className="truncate font-mono text-lg tabular text-foreground">
            {formatCurrency(price, currency)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {verified ? (
            <VerifiedBadge size="sm" />
          ) : (
            <span className="text-[10px] uppercase text-muted">Unverified</span>
          )}
          <Button size="sm" asChild>
            <Link href={`#${actionsAnchorId}`}>Actions</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
