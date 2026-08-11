import Link from "next/link";
import { DEMO_BUSINESSES } from "@/lib/data/demo";
import { formatCurrency, lifecycleLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "My Businesses" };

export default function MyBusinessesPage() {
  const businesses = DEMO_BUSINESSES.filter((b) => b.current_owner_id === "seller-1");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Businesses</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Lifecycle-aware portfolio — IDEA → BUILDING → LIVE → GROWING → FOR_SALE → …
      </p>

      <div className="mt-6 space-y-4">
        {businesses.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{b.name}</CardTitle>
                <Badge variant="outline" className="mt-2">
                  {lifecycleLabel(b.lifecycle)}
                </Badge>
              </div>
              <div className="text-right text-sm">
                <p className="text-zinc-500">Value</p>
                <p className="font-semibold text-white">
                  {formatCurrency(b.asking_price)}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-zinc-500">MRR</p>
                  <p className="text-zinc-200">{formatCurrency(b.monthly_revenue)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Profit</p>
                  <p className="text-zinc-200">{formatCurrency(b.monthly_profit)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Traffic</p>
                  <p className="text-zinc-200">{b.monthly_traffic?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-zinc-500">AI Score</p>
                  <p className="text-zinc-200">{b.ai_score}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/businesses/${b.slug}`}>Manage</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/sell">Sell</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/rent">Rent</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/dashboard/ai">Analyze</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/passport/${b.id}`}>Passport</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
