"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  TrendingUp,
  Users,
  Zap,
  ShieldCheck,
} from "lucide-react";
import type { Listing } from "@/types/database";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  scoreColor,
  CATEGORY_LABELS,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VERIFICATION_BADGE_LABELS } from "@/lib/verification/labels";

export function BusinessCard({
  listing,
  index = 0,
}: {
  listing: Listing;
  index?: number;
}) {
  const b = listing.business;
  if (!b) return null;

  const typeBadge =
    listing.listing_type === "REVIVE"
      ? { label: "REVIVE", variant: "warning" as const }
      : listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
        ? { label: listing.listing_type === "RENT_TO_OWN" ? "RENT TO OWN" : "RENT", variant: "info" as const }
        : { label: "BUY", variant: "success" as const };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Card className="group overflow-hidden transition-colors hover:border-violet-500/30">
        <CardContent className="p-0">
          <div className="relative h-28 bg-gradient-to-br from-violet-950/80 via-indigo-950/60 to-zinc-950 p-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent" />
            <div className="relative flex items-start justify-between">
              <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
              <div className={cn("text-sm font-semibold tabular-nums", scoreColor(b.ai_score))}>
                AI {b.ai_score ?? "—"}/100
              </div>
            </div>
            <h3 className="relative mt-6 text-lg font-semibold text-white">
              {b.name}
            </h3>
            <p className="relative mt-0.5 text-xs text-zinc-400">
              {CATEGORY_LABELS[b.category] ?? b.category}
            </p>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-zinc-500">
                  {listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
                    ? "Monthly rent"
                    : "Price"}
                </p>
                <p className="text-xl font-semibold text-white">
                  {listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
                    ? formatCurrency(listing.rental_price_monthly, listing.currency)
                    : formatCurrency(listing.price, listing.currency)}
                  {(listing.listing_type === "RENT" ||
                    listing.listing_type === "RENT_TO_OWN") && (
                    <span className="text-sm font-normal text-zinc-500">/mo</span>
                  )}
                </p>
              </div>
              {listing.rental_price_monthly && listing.listing_type === "BUY" && (
                <p className="text-xs text-zinc-500">
                  or {formatCurrency(listing.rental_price_monthly)}/mo rent
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric icon={TrendingUp} label="Revenue" value={formatCurrency(b.monthly_revenue) + "/mo"} />
              <Metric icon={Zap} label="Profit" value={formatCurrency(b.monthly_profit) + "/mo"} />
              <Metric icon={Users} label="Traffic" value={formatNumber(b.monthly_traffic) + "/mo"} />
              <Metric
                icon={ArrowUpRight}
                label="Growth"
                value={formatPercent(b.growth_rate)}
              />
            </div>

            {(listing.verifications?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {listing.verifications!.slice(0, 3).map((v) => (
                  <Badge key={v.id} variant="success" className="gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                    {VERIFICATION_BADGE_LABELS[v.type]}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" asChild>
                <Link href={`/listings/${listing.id}`}>
                  {listing.listing_type === "REVIVE"
                    ? "Revive"
                    : listing.listing_type === "RENT" || listing.listing_type === "RENT_TO_OWN"
                      ? "Rent"
                      : "Buy Now"}
                </Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/listings/${listing.id}?action=offer`}>Offer</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 font-medium text-zinc-200">{value}</p>
    </div>
  );
}
