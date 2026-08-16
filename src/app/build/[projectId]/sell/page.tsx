"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, VALUATION_DISCLAIMER } from "@/lib/utils";
import {
  cacheFactoryProject,
  readCachedFactoryProject,
} from "@/lib/factory/client-cache";

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
    listingDraft?: {
      title: string;
      summary: string;
      description: string;
      suggestedAskingPriceRange: {
        minEur: number;
        maxEur: number;
        estimateEur: number;
        note: string;
      };
      aiScore: number | null;
      businessPassportPath: string;
    };
    businessPassportPath?: string;
    aiScore?: number | null;
    risks: string[];
    recommendedImprovements: string[];
    listOnSiteflipPath: string;
    disclaimer: string;
    assumptions: string[];
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    const id = params.projectId;
    const cached = readCachedFactoryProject(id);
    if (cached) {
      await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
    }
    const res = await fetch(`/api/factory/projects/${id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: cached }),
    });
    const json = await res.json();
    if (res.ok && cached) {
      // Refresh cache after sell approval added
      const refreshed = await fetch(`/api/factory/projects/${id}`);
      if (refreshed.ok) {
        const body = await refreshed.json();
        if (body.project) cacheFactoryProject(body.project);
      }
    }
    setData(
      res.ok
        ? json
        : { ...json, error: json.error || "Failed to prepare BUILD → SELL draft" }
    );
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

      {data?.error && (
        <p className="mt-4 text-sm text-rose-400">{data.error}</p>
      )}

      {data && !data.error && (
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
            <CardContent className="space-y-2 text-sm text-zinc-300">
              <p className="font-medium text-white">
                {data.listingDraft?.title || "Draft"}
              </p>
              <p>{data.listingDraft?.summary || data.listingDescription}</p>
              {data.listingDraft?.suggestedAskingPriceRange && (
                <p className="text-xs text-zinc-500">
                  Suggested asking range (estimate):{" "}
                  {formatCurrency(data.listingDraft.suggestedAskingPriceRange.minEur)}{" "}
                  –{" "}
                  {formatCurrency(data.listingDraft.suggestedAskingPriceRange.maxEur)}
                  . {data.listingDraft.suggestedAskingPriceRange.note}
                </p>
              )}
              <p className="text-xs text-zinc-500">
                AI Score: {data.aiScore ?? data.listingDraft?.aiScore ?? "—"}/100
              </p>
              <Button size="sm" variant="secondary" asChild>
                <Link
                  href={
                    data.businessPassportPath ||
                    data.listingDraft?.businessPassportPath ||
                    `/build/${params.projectId}/passport`
                  }
                >
                  Open Business Passport
                </Link>
              </Button>
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
            <Link href={data.listOnSiteflipPath}>List on JIY.APP</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
