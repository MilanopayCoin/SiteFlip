import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { getListingById, DEMO_EVENTS, DEMO_REVIVAL_PLANS, DEMO_VALUATIONS, DEMO_SELLERS } from "@/lib/data/demo";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  scoreColor,
  CATEGORY_LABELS,
  VALUATION_DISCLAIMER,
} from "@/lib/utils";
import { VERIFICATION_BADGE_LABELS } from "@/lib/verification/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingActions } from "@/components/marketplace/listing-actions";
import { BusinessTimeline } from "@/components/business/timeline";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = getListingById(id);
  return { title: listing?.title ?? "Listing" };
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing?.business) notFound();

  const b = listing.business;
  const seller = listing.seller ?? DEMO_SELLERS.find((s) => s.id === listing.seller_id);
  const events = DEMO_EVENTS.filter((e) => e.business_id === b.id);
  const revival = DEMO_REVIVAL_PLANS.find((r) => r.business_id === b.id);
  const valuation = DEMO_VALUATIONS.find((v) => v.business_id === b.id);
  const isRent = ["RENT", "RENT_TO_OWN"].includes(listing.listing_type);
  const isRevive = listing.listing_type === "REVIVE";

  const remainingBalance =
    isRent &&
    listing.rent_to_own_credit_percent &&
    listing.price &&
    listing.rental_price_monthly &&
    listing.rent_to_own_period_months
      ? Math.max(
          0,
          listing.price -
            listing.rental_price_monthly *
              listing.rent_to_own_period_months *
              (listing.rent_to_own_credit_percent / 100)
        )
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant={isRevive ? "warning" : isRent ? "info" : "success"}>
          {listing.listing_type.replace(/_/g, " ")}
        </Badge>
        <Badge variant="outline">{CATEGORY_LABELS[b.category] ?? b.category}</Badge>
        <Badge variant="outline" className={scoreColor(b.ai_score)}>
          AI Score {b.ai_score}/100
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{b.name}</h1>
            {b.tagline && <p className="mt-2 text-lg text-zinc-400">{b.tagline}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Revenue" value={`${formatCurrency(b.monthly_revenue)}/mo`} icon={TrendingUp} />
            <Stat label="Profit" value={`${formatCurrency(b.monthly_profit)}/mo`} icon={Zap} />
            <Stat label="Traffic" value={`${formatNumber(b.monthly_traffic)}/mo`} icon={Users} />
            <Stat label="Growth" value={formatPercent(b.growth_rate)} icon={ArrowUpRight} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-300">
              <p>{b.description}</p>
              {b.reason_for_selling && (
                <p>
                  <span className="text-zinc-500">Reason for selling: </span>
                  {b.reason_for_selling}
                </p>
              )}
              {b.technology_stack.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {b.technology_stack.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(listing.verifications?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {listing.verifications!.map((v) => (
                  <Badge key={v.id} variant="success" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {VERIFICATION_BADGE_LABELS[v.type]}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {isRevive && (
            <Card>
              <CardHeader>
                <CardTitle>Revive Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {b.original_story && (
                  <div>
                    <p className="text-xs uppercase text-amber-400">Seller claim — Original story</p>
                    <p className="mt-1 text-zinc-300">{b.original_story}</p>
                  </div>
                )}
                {b.current_condition && (
                  <div>
                    <p className="text-xs uppercase text-amber-400">Seller claim — Current condition</p>
                    <p className="mt-1 text-zinc-300">{b.current_condition}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">Domain age</p>
                    <p className="text-zinc-200">{b.domain_age_years ?? "—"} years</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Last activity</p>
                    <p className="text-zinc-200">
                      {b.last_activity_at
                        ? new Date(b.last_activity_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                {revival && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <p className="font-medium text-violet-300">
                      AI Revival Score: {revival.revival_score}/100
                    </p>
                    <p className="mt-2 text-zinc-400">{revival.what_should_change}</p>
                    <div className="mt-3">
                      <p className="text-xs uppercase text-zinc-500">AI assumptions</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-400">
                        {revival.ai_assumptions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <Button className="mt-4" asChild>
                      <Link href={`/revive?focus=${b.id}`}>View full revival plan</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isRent && listing.rent_to_own_credit_percent && (
            <Card>
              <CardHeader>
                <CardTitle>Rent to Own</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-zinc-500">Monthly payment</p>
                  <p className="text-lg text-white">
                    {formatCurrency(listing.rental_price_monthly, listing.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Contract period</p>
                  <p className="text-lg text-white">
                    {listing.rent_to_own_period_months} months
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Purchase option</p>
                  <p className="text-lg text-white">
                    {formatCurrency(listing.price, listing.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Credit toward purchase</p>
                  <p className="text-lg text-white">{listing.rent_to_own_credit_percent}%</p>
                </div>
                {remainingBalance != null && (
                  <div className="sm:col-span-2">
                    <p className="text-zinc-500">Illustrative remaining balance after full term</p>
                    <p className="text-lg text-white">
                      {formatCurrency(remainingBalance, listing.currency)}
                    </p>
                  </div>
                )}
                <p className="sm:col-span-2 text-xs text-zinc-600">
                  Flexible transaction architecture only — not an automatic legally binding
                  ownership transfer.
                </p>
              </CardContent>
            </Card>
          )}

          {valuation && (
            <Card>
              <CardHeader>
                <CardTitle>AI Valuation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-zinc-500">Estimate</p>
                    <p className="text-white">{formatCurrency(valuation.estimated_value)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Min</p>
                    <p className="text-white">{formatCurrency(valuation.minimum_value)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Max</p>
                    <p className="text-white">{formatCurrency(valuation.maximum_value)}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600">{VALUATION_DISCLAIMER}</p>
              </CardContent>
            </Card>
          )}

          {events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Business Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <BusinessTimeline events={events} />
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="sticky top-24">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-xs text-zinc-500">
                  {isRent ? "Monthly rent" : "Asking price"}
                </p>
                <p className="text-3xl font-semibold text-white">
                  {isRent
                    ? formatCurrency(listing.rental_price_monthly, listing.currency)
                    : formatCurrency(listing.price, listing.currency)}
                  {isRent && <span className="text-base font-normal text-zinc-500">/mo</span>}
                </p>
                {!isRent && listing.rental_price_monthly && (
                  <p className="mt-1 text-sm text-zinc-500">
                    or rent {formatCurrency(listing.rental_price_monthly)}/mo
                  </p>
                )}
              </div>

              <ListingActions listing={listing} />

              <div className="border-t border-white/10 pt-4 text-sm">
                <p className="text-zinc-500">Seller</p>
                <p className="font-medium text-white">{seller?.full_name ?? "Seller"}</p>
                <p className="text-zinc-400">
                  Seller Score {seller?.seller_score ?? "—"} ·{" "}
                  {seller?.successful_transactions ?? 0} transactions
                </p>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <Link href={`/passport/${b.id}`}>Business Passport</Link>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href={`/businesses/${b.slug}`}>Full business view</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-medium text-zinc-100">{value}</p>
    </div>
  );
}
