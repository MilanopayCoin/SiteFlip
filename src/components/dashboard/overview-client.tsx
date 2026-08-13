"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashBiz = {
  id: string;
  name: string;
  lifecycle: string;
  asking_price: number | null;
  monthly_revenue: number | null;
  monthly_profit: number | null;
  ai_score: number | null;
};

type Overview = {
  owned: DashBiz[];
  listings: number;
  offers: number;
  watch: number;
  rentals: number;
  modeLabel: "LIVE" | "DEMO";
};

export function DashboardOverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [bizRes, offerRes, sessionRes] = await Promise.all([
          fetch("/api/businesses"),
          fetch("/api/offers"),
          fetch("/api/auth/session"),
        ]);
        const biz = await bizRes.json().catch(() => ({}));
        const offers = await offerRes.json().catch(() => ({}));
        const session = await sessionRes.json().catch(() => ({}));
        if (cancelled) return;

        const owned = (biz.businesses ?? []) as DashBiz[];
        const authenticated = Boolean(session.authenticated);
        setData({
          owned,
          listings: Array.isArray(biz.listings) ? biz.listings.length : 0,
          offers: Array.isArray(offers.offers) ? offers.offers.length : 0,
          watch: 0,
          rentals: 0,
          modeLabel: authenticated ? "LIVE" : "DEMO",
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400">
          {error || "Could not load portfolio."}
        </p>
        <Button asChild>
          <Link href="/build">Open Business Factory</Link>
        </Button>
      </div>
    );
  }

  const forSale = data.owned.filter((b) =>
    ["FOR_SALE", "FOR_RENT"].includes(b.lifecycle)
  );
  const portfolioValue = data.owned.reduce(
    (s, b) => s + (b.asking_price ?? 0),
    0
  );
  const mrr = data.owned.reduce((s, b) => s + (b.monthly_revenue ?? 0), 0);
  const profit = data.owned.reduce((s, b) => s + (b.monthly_profit ?? 0), 0);
  const avgScore =
    data.owned.reduce((s, b) => s + (b.ai_score ?? 0), 0) /
    Math.max(data.owned.length, 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            {data.modeLabel === "LIVE"
              ? "Live portfolio from your JIY.APP account."
              : "Sign in to see your persisted portfolio."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={data.modeLabel === "LIVE" ? "success" : "warning"}>
            {data.modeLabel === "LIVE" ? "LIVE" : "LOCAL / DEMO"}
          </Badge>
          <Button variant="outline" asChild>
            <Link href="/profile">Profile</Link>
          </Button>
          <Button asChild>
            <Link href="/build">Business Factory</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Portfolio value" value={formatCurrency(portfolioValue)} />
        <Stat title="Businesses owned" value={String(data.owned.length)} />
        <Stat title="For sale / rent" value={String(forSale.length)} />
        <Stat title="Monthly revenue" value={formatCurrency(mrr)} />
        <Stat title="Monthly profit" value={formatCurrency(profit)} />
        <Stat
          title="Avg AI score"
          value={avgScore ? avgScore.toFixed(0) : "—"}
        />
        <Stat title="Active listings" value={String(data.listings)} />
        <Stat
          title="Offers / Watch / Rentals"
          value={`${data.offers} / ${data.watch} / ${data.rentals}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/build">Start Fast Create</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/dashboard/businesses">My Businesses</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/listings">My Listings</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/offers">My Offers</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/profile">Edit profile</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>
              Offers: {data.offers} · Businesses: {data.owned.length}
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/build">Open Factory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My businesses snapshot</CardTitle>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/dashboard/businesses">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.owned.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No businesses yet.{" "}
              <Link href="/build" className="text-violet-300">
                Create with Fast Create
              </Link>
            </p>
          ) : (
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
                {data.owned.slice(0, 8).map((b) => (
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
                    <td className="py-3 text-zinc-300">{b.ai_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
