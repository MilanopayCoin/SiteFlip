"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, VALUATION_DISCLAIMER } from "@/lib/utils";

export default function FactorySellPage() {
  const params = useParams<{ projectId: string }>();
  const [data, setData] = useState<{
    saleReadinessScore: number;
    suggestedValuation: {
      estimated_value: number;
      minimum_value: number;
      maximum_value: number;
      confidence: number;
    };
    listingDescription: string;
    risks: string[];
    recommendedImprovements: string[];
    listOnSiteflipPath: string;
    disclaimer: string;
    assumptions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    const res = await fetch(`/api/factory/projects/${params.projectId}/sell`, {
      method: "POST",
    });
    setData(await res.json());
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/build/${params.projectId}`}>← Back</Link>
      </Button>
      <h1 className="mt-4 text-2xl font-semibold text-white">Prepare for sale</h1>
      <p className="mt-1 text-sm text-zinc-400">
        BUILD → SELL. No fabricated revenue or traffic.
      </p>

      <Button className="mt-6" onClick={prepare} disabled={loading}>
        {loading ? "Analyzing…" : "Prepare for sale"}
      </Button>

      {data && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs text-zinc-500">Sale readiness</p>
                <p className="text-2xl font-semibold text-white">
                  {data.saleReadinessScore}/100
                </p>
              </div>
              <Badge variant="warning">Early-stage</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Suggested valuation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-white">
                {formatCurrency(data.suggestedValuation.estimated_value)} (range{" "}
                {formatCurrency(data.suggestedValuation.minimum_value)} –{" "}
                {formatCurrency(data.suggestedValuation.maximum_value)})
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                {data.disclaimer || VALUATION_DISCLAIMER}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Listing draft</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              {data.listingDescription}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Improvements before sale</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-400">
                {data.recommendedImprovements.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <ul className="list-disc pl-4 text-xs text-amber-200/80">
            {data.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <Button asChild>
            <Link href={data.listOnSiteflipPath}>List on SITEFLIP</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
