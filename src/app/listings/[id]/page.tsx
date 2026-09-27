import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  fetchListingById,
  fetchSeller,
} from "@/lib/data/marketplace-data";
import {
  formatCurrency,
  formatNumber,
  CATEGORY_LABELS,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingActions } from "@/components/marketplace/listing-actions";
import {
  claimLabel,
  isJiyVerified,
  laneState,
  transferReadiness,
  type VerificationLane,
} from "@/lib/marketplace/verification";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { listing } = await fetchListingById(id);
  const title = listing?.business?.name ?? listing?.title ?? "Listing";
  return {
    title,
    description: listing?.summary ?? undefined,
    openGraph: {
      title: `${title} · JIY.APP`,
      description: listing?.summary ?? "Digital business listing on JIY.APP",
    },
    robots: { index: true, follow: true },
  };
}

const LANES: { lane: VerificationLane; label: string }[] = [
  { lane: "OWNERSHIP", label: "Ownership" },
  { lane: "REVENUE", label: "Revenue" },
  { lane: "ANALYTICS", label: "Analytics" },
  { lane: "DOMAIN", label: "Domain" },
  { lane: "CODE_ASSETS", label: "Code / Assets" },
  { lane: "IDENTITY", label: "Identity" },
];

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const { listing, mode } = await fetchListingById(id);
  if (!listing?.business) notFound();

  const b = listing.business;
  const seller = listing.seller ?? (await fetchSeller(listing.seller_id));
  const isRent = ["RENT", "RENT_TO_OWN"].includes(listing.listing_type);
  const isRevive = listing.listing_type === "REVIVE";
  const isDemo = mode === "demo" || b.is_demo;
  const verifications = listing.verifications ?? [];
  const jiyVerified = isJiyVerified(verifications);
  const readiness = transferReadiness(verifications);
  const revenueOk = laneState("REVENUE", verifications) === "VERIFIED";
  const analyticsOk = laneState("ANALYTICS", verifications) === "VERIFIED";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">
          {isRevive ? "REVIVE" : isRent ? "RENT" : "BUY"}
        </Badge>
        <Badge variant="outline">
          {CATEGORY_LABELS[b.category] ?? b.category}
        </Badge>
        {isDemo && <Badge variant="warning">DEMO</Badge>}
        {jiyVerified && (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            JIY VERIFIED
          </Badge>
        )}
        <Badge variant="outline">Transfer {readiness}</Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              {b.name}
            </h1>
            {b.tagline && (
              <p className="mt-2 text-lg text-zinc-500">{b.tagline}</p>
            )}
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Overview
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {listing.summary || b.description || "No description provided."}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Price"
              value={
                isRent
                  ? `${formatCurrency(listing.rental_price_monthly, listing.currency)}/mo`
                  : formatCurrency(listing.price, listing.currency)
              }
              claim="VERIFIED"
            />
            <Metric
              label="Revenue"
              value={
                b.monthly_revenue != null
                  ? `${formatCurrency(b.monthly_revenue)}/mo`
                  : "—"
              }
              claim={claimLabel(revenueOk)}
            />
            <Metric
              label="Profit"
              value={
                b.monthly_profit != null
                  ? `${formatCurrency(b.monthly_profit)}/mo`
                  : "—"
              }
              claim={claimLabel(revenueOk)}
            />
            <Metric
              label="Users"
              value={
                b.monthly_traffic != null
                  ? formatNumber(b.monthly_traffic)
                  : "—"
              }
              claim={claimLabel(analyticsOk)}
            />
            <Metric
              label="Age"
              value={
                b.domain_age_years != null
                  ? `${b.domain_age_years} yrs`
                  : "—"
              }
              claim="UNVERIFIED"
            />
            <Metric
              label="Category"
              value={CATEGORY_LABELS[b.category] ?? b.category}
              claim="VERIFIED"
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600">
              {b.website_url && (
                <p>
                  Website:{" "}
                  <a
                    href={b.website_url}
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {b.website_url}
                  </a>
                </p>
              )}
              {b.domain && <p>Domain: {b.domain}</p>}
              {b.reason_for_selling && (
                <p>Reason: {b.reason_for_selling}</p>
              )}
              {isRevive && b.current_condition && (
                <p>Current status: {b.current_condition}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {LANES.map(({ lane, label }) => {
                const state = laneState(lane, verifications);
                return (
                  <div
                    key={lane}
                    className="flex items-center justify-between border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-700">{label}</span>
                    <span
                      className={
                        state === "VERIFIED"
                          ? "font-medium text-emerald-700"
                          : state === "FAILED"
                            ? "font-medium text-red-600"
                            : "text-zinc-500"
                      }
                    >
                      {state}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {isRent && (
            <Card>
              <CardHeader>
                <CardTitle>Deal terms · Rent</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-zinc-500">Monthly</p>
                  <p className="text-zinc-900">
                    {formatCurrency(
                      listing.rental_price_monthly,
                      listing.currency
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Minimum term</p>
                  <p className="text-zinc-900">
                    {listing.minimum_rental_months
                      ? `${listing.minimum_rental_months} months`
                      : "—"}
                  </p>
                </div>
                <p className="sm:col-span-2 text-xs text-zinc-500">
                  Rent does not transfer ownership. Access rights are agreed in
                  the deal room.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="sticky top-24">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-xs text-zinc-500">
                  {isRent ? "Monthly rent" : "Price"}
                </p>
                <p className="text-3xl font-semibold text-zinc-900">
                  {isRent
                    ? formatCurrency(
                        listing.rental_price_monthly,
                        listing.currency
                      )
                    : formatCurrency(listing.price, listing.currency)}
                  {isRent && (
                    <span className="text-base font-normal text-zinc-500">
                      /mo
                    </span>
                  )}
                </p>
              </div>

              <ListingActions listing={listing} />

              <div className="border-t border-zinc-200 pt-4 text-sm">
                <p className="text-zinc-500">Seller</p>
                <p className="font-medium text-zinc-900">
                  {seller?.display_name ?? seller?.full_name ?? "Seller"}
                </p>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <Link href="/marketplace">Back to marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  claim,
}: {
  label: string;
  value: string;
  claim: "VERIFIED" | "UNVERIFIED";
}) {
  return (
    <div className="border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
        <span
          className={
            claim === "VERIFIED"
              ? "text-[10px] font-medium text-emerald-700"
              : "text-[10px] font-medium text-zinc-400"
          }
        >
          {claim}
        </span>
      </div>
      <p className="mt-1 font-medium text-zinc-900">{value}</p>
    </div>
  );
}
