"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, lifecycleLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Business = {
  id: string;
  slug: string;
  name: string;
  lifecycle: string;
  asking_price: number | null;
  monthly_revenue: number | null;
  monthly_profit: number | null;
  monthly_traffic: number | null;
  ai_score: number | null;
  is_demo?: boolean;
};

export function MyBusinessesClient() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [mode, setMode] = useState<string>("demo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBusinesses(data.businesses ?? []);
      setMode(data.mode ?? "demo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  if (error) {
    return (
      <div className="mt-6">
        <EmptyState
          title="Couldn’t load businesses"
          description={error}
        />
        <Button className="mt-4" variant="secondary" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Businesses</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Lifecycle portfolio
            {mode === "demo" ? " · DEMO mode" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/revive/new">Revive project</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/businesses/new">Create business</Link>
          </Button>
        </div>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Create your first digital business, or start from the Business Factory."
          actionHref="/dashboard/businesses/new"
          actionLabel="Create business"
        />
      ) : (
        <div className="mt-6 space-y-4">
          {businesses.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {b.name}
                    {b.is_demo && <Badge variant="warning">DEMO</Badge>}
                  </CardTitle>
                  <Badge variant="outline" className="mt-2">
                    {lifecycleLabel(b.lifecycle as never)}
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
                    <p className="text-zinc-200">
                      {formatCurrency(b.monthly_revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Profit</p>
                    <p className="text-zinc-200">
                      {formatCurrency(b.monthly_profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Traffic</p>
                    <p className="text-zinc-200">
                      {b.monthly_traffic?.toLocaleString() ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">AI Score</p>
                    <p className="text-zinc-200">{b.ai_score ?? "—"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/businesses/${b.slug}`}>Manage</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/listings/new">List</Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/passport/${b.id}`}>Passport</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {error === null && businesses.length > 0 && (
        <Button className="mt-4" variant="ghost" size="sm" onClick={load}>
          Refresh
        </Button>
      )}
    </div>
  );
}
