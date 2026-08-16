import { notFound } from "next/navigation";
import {
  DEMO_EVENTS,
  DEMO_SELLERS,
  DEMO_VERIFICATIONS,
  getBusinessBySlug,
} from "@/lib/data/demo";
import {
  formatCurrency,
  formatNumber,
  scoreColor,
  CATEGORY_LABELS,
  lifecycleLabel,
  cn,
} from "@/lib/utils";
import { VERIFICATION_BADGE_LABELS } from "@/lib/verification/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessTimeline } from "@/components/business/timeline";
import { ShieldCheck } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const b = getBusinessBySlug(id);
  return { title: b ? `Passport · ${b.name}` : "Business Passport" };
}

export default async function PassportPage({ params }: Props) {
  const { id } = await params;
  const b = getBusinessBySlug(id);
  if (!b) notFound();

  const owner = DEMO_SELLERS.find((s) => s.id === b.current_owner_id);
  const verifications = DEMO_VERIFICATIONS.filter(
    (v) => v.business_id === b.id && v.status === "VERIFIED"
  );
  const events = DEMO_EVENTS.filter((e) => e.business_id === b.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-400">
        Business Passport
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-white">{b.name}</h1>
      <p className="mt-1 font-mono text-sm text-zinc-500">ID: {b.id}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <Row label="Owner" value={owner?.full_name ?? "Private"} />
            <Row label="Created" value={new Date(b.created_at).toLocaleDateString()} />
            <Row label="Status" value={lifecycleLabel(b.lifecycle)} />
            <Row label="Category" value={CATEGORY_LABELS[b.category] ?? b.category} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <Row
              label="AI Score"
              value={`${b.ai_score ?? "—"}/100`}
              className={scoreColor(b.ai_score)}
            />
            <Row label="Health Score" value={`${b.health_score ?? "—"}/100`} />
            <Row label="Risk Score" value={`${b.risk_score ?? "—"}/100`} />
            <Row label="Asking value" value={formatCurrency(b.asking_price)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Public metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-zinc-500">Revenue</p>
            <p className="text-white">{formatCurrency(b.monthly_revenue)}/mo</p>
          </div>
          <div>
            <p className="text-zinc-500">Profit</p>
            <p className="text-white">{formatCurrency(b.monthly_profit)}/mo</p>
          </div>
          <div>
            <p className="text-zinc-500">Traffic</p>
            <p className="text-white">{formatNumber(b.monthly_traffic)}/mo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Verification history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {verifications.length === 0 && (
            <p className="text-sm text-zinc-500">No verified badges yet.</p>
          )}
          {verifications.map((v) => (
            <Badge key={v.id} variant="success" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {VERIFICATION_BADGE_LABELS[v.type]} ·{" "}
              {v.verified_at
                ? new Date(v.verified_at).toLocaleDateString()
                : "—"}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessTimeline events={events} />
          </CardContent>
        </Card>
      )}

      <p className="mt-6 text-xs text-zinc-600">
        Privacy: only legally and privacy-appropriate information is shown. Personal
        emails, payment credentials, and private transaction details are never exposed
        on the public passport.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("text-zinc-200", className)}>{value}</span>
    </div>
  );
}
