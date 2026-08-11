import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DEMO_EVENTS,
  DEMO_SELLERS,
  DEMO_VERIFICATIONS,
  getBusinessBySlug,
  getEnrichedListings,
} from "@/lib/data/demo";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  lifecycleLabel,
  CATEGORY_LABELS,
  scoreColor,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessTimeline } from "@/components/business/timeline";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const b = getBusinessBySlug(id);
  return { title: b?.name ?? "Business" };
}

export default async function BusinessPage({ params }: Props) {
  const { id } = await params;
  const b = getBusinessBySlug(id);
  if (!b) notFound();

  const owner = DEMO_SELLERS.find((s) => s.id === b.current_owner_id);
  const listings = getEnrichedListings().filter((l) => l.business_id === b.id);
  const events = DEMO_EVENTS.filter((e) => e.business_id === b.id);
  const verified = DEMO_VERIFICATIONS.filter(
    (v) => v.business_id === b.id && v.status === "VERIFIED"
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">{lifecycleLabel(b.lifecycle)}</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-white">{b.name}</h1>
          <p className="mt-1 text-zinc-400">
            {CATEGORY_LABELS[b.category]} · Owner: {owner?.full_name ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/passport/${b.id}`}>Passport</Link>
          </Button>
          {listings[0] && (
            <Button asChild>
              <Link href={`/listings/${listings[0].id}`}>View listing</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Revenue", `${formatCurrency(b.monthly_revenue)}/mo`],
          ["Profit", `${formatCurrency(b.monthly_profit)}/mo`],
          ["Traffic", `${formatNumber(b.monthly_traffic)}/mo`],
          ["Growth", formatPercent(b.growth_rate)],
          ["AI Score", `${b.ai_score}/100`],
          ["Health", `${b.health_score}/100`],
          ["Value", formatCurrency(b.asking_price)],
          ["Risk", `${b.risk_score}/100`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p
                className={`mt-1 font-semibold ${
                  label === "AI Score" ? scoreColor(b.ai_score) : "text-white"
                }`}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-300">
          <p>{b.description}</p>
          {verified.length > 0 && (
            <p className="mt-3 text-xs text-emerald-400">
              {verified.length} verification badge(s) — never fabricated.
            </p>
          )}
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessTimeline events={events} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
