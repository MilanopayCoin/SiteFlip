import Link from "next/link";
import { DEMO_BUSINESSES, getEnrichedListings } from "@/lib/data/demo";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const owned = DEMO_BUSINESSES.filter((b) => b.current_owner_id === "seller-1");
  const forSale = owned.filter((b) =>
    ["FOR_SALE", "FOR_RENT"].includes(b.lifecycle)
  );
  const portfolioValue = owned.reduce((s, b) => s + (b.asking_price ?? 0), 0);
  const mrr = owned.reduce((s, b) => s + (b.monthly_revenue ?? 0), 0);
  const profit = owned.reduce((s, b) => s + (b.monthly_profit ?? 0), 0);
  const avgScore =
    owned.reduce((s, b) => s + (b.ai_score ?? 0), 0) / Math.max(owned.length, 1);
  const listings = getEnrichedListings().filter((l) => l.seller_id === "seller-1");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            Demo portfolio for Alex Rivera — connect Supabase Auth for live data.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/ai">AI Command Center</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Portfolio value" value={formatCurrency(portfolioValue)} />
        <Stat title="Businesses owned" value={String(owned.length)} />
        <Stat title="For sale / rent" value={String(forSale.length)} />
        <Stat title="Monthly revenue" value={formatCurrency(mrr)} />
        <Stat title="Monthly profit" value={formatCurrency(profit)} />
        <Stat title="Avg AI score" value={avgScore.toFixed(0)} />
        <Stat title="Active listings" value={String(listings.length)} />
        <Stat title="Businesses rented" value="0" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>• CopyForge AI listed for sale — €32,000</p>
            <p>• AI Invoice SaaS received 3 new views today</p>
            <p>• Domain verification active on 2 businesses</p>
            <p>• Rent-to-own inquiry on WanderMetrics (demo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-zinc-300">
              Consider listing SkillFrame Courses — health score 80, growing steadily.
            </p>
            <p className="text-zinc-300">
              WanderMetrics traffic is declining (−2.5%). Review SEO or rent-to-own terms.
            </p>
            <p className="text-xs text-zinc-600">
              Recommendations use platform demo data. Assumptions labeled in Command Center.
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/dashboard/ai">Ask AI</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My businesses snapshot</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="pb-3 pr-4">Business</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Value</th>
                <th className="pb-3 pr-4">MRR</th>
                <th className="pb-3">AI Score</th>
              </tr>
            </thead>
            <tbody>
              {owned.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-medium text-white">{b.name}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline">{b.lifecycle}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {formatCurrency(b.asking_price)}
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {formatCurrency(b.monthly_revenue)}
                  </td>
                  <td className="py-3 text-zinc-300">{b.ai_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-zinc-500">{title}</p>
        <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}
