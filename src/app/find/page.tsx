"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MatchResult {
  listing_id: string;
  match_percent: number;
  reasons: string[];
  listing: {
    id: string;
    title: string;
    price: number | null;
    summary: string | null;
    business?: {
      name?: string;
      monthly_profit?: number | null;
      ai_score?: number | null;
    } | null;
  };
}

export default function FindPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: Number(fd.get("budget")),
          desiredMonthlyProfit: Number(fd.get("desiredMonthlyProfit")),
          businessType: fd.get("businessType") || "any",
          risk: fd.get("risk"),
          workload: fd.get("workload"),
          growth: fd.get("growth"),
          minRevenue: fd.get("minRevenue") ? Number(fd.get("minRevenue")) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match failed");
      setResults(data.results ?? data.matches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">
        Find My Business
      </h1>
      <p className="mt-2 text-zinc-400">
        Deterministic filters first. AI ranking second. Best matches for your criteria.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="budget">Budget (€)</Label>
              <Input id="budget" name="budget" type="number" required defaultValue={15000} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="desiredMonthlyProfit">Desired monthly profit (€)</Label>
              <Input id="desiredMonthlyProfit" name="desiredMonthlyProfit" type="number" required defaultValue={1000} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="businessType">Business type</Label>
              <select id="businessType" name="businessType" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200">
                <option value="any">Any</option>
                <option value="saas">SaaS</option>
                <option value="ai_tools">AI Tools</option>
                <option value="shopify">Shopify</option>
                <option value="newsletter">Newsletter</option>
                <option value="affiliate">Affiliate</option>
                <option value="chrome_extensions">Chrome Extensions</option>
              </select>
            </div>
            <div>
              <Label htmlFor="risk">Risk</Label>
              <select id="risk" name="risk" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label htmlFor="workload">Workload</Label>
              <select id="workload" name="workload" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label htmlFor="growth">Growth preference</Label>
              <select id="growth" name="growth" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200">
                <option value="stable">Stable</option>
                <option value="growing">Growing</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} size="lg">
                {loading ? "Matching…" : "Find best matches"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-white">Best Matches</h2>
          {results.map((r) => (
            <Card key={r.listing_id}>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {r.listing.business?.name || r.listing.title}
                    </h3>
                    <Badge variant="success">Match {r.match_percent}%</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{r.listing.summary}</p>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                    {r.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
                <Button asChild>
                  <Link href={`/listings/${r.listing_id}`}>View</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
