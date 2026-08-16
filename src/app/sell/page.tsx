"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, VALUATION_DISCLAIMER } from "@/lib/utils";

export default function SellPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    listing_draft?: {
      title: string;
      summary: string;
      risk_analysis?: string;
    };
    listing?: { title: string; summary: string; riskAnalysis?: string };
    valuation?: {
      estimated_value: number;
      minimum_value: number;
      maximum_value: number;
      confidence: number;
      ai_score?: number;
      risk_score?: number;
      revenue_multiple?: number;
      profit_multiple?: number;
      disclaimer?: string;
    };
    disclaimer?: string;
    assumptions?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/ai/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: fd.get("websiteUrl") || "",
          businessType: fd.get("businessType"),
          name: fd.get("name"),
          revenue: Number(fd.get("revenue")),
          profit: Number(fd.get("profit")),
          traffic: Number(fd.get("traffic")),
          expenses: Number(fd.get("expenses")),
          technology: fd.get("technology"),
          domain: fd.get("domain"),
          growth: Number(fd.get("growth")),
          reasonForSelling: fd.get("reasonForSelling"),
          askingPrice: Number(fd.get("askingPrice")),
          description: fd.get("description"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate listing");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">
        Sell your digital business
      </h1>
      <p className="mt-2 text-zinc-400">
        Enter your metrics. AI creates a listing draft, valuation, AI Score, and risk
        analysis. Seller-claimed figures are never auto-marked verified.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Business details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" name="name" required defaultValue="My SaaS" />
            <div>
              <Label htmlFor="businessType">Business type</Label>
              <select
                id="businessType"
                name="businessType"
                className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                defaultValue="saas"
              >
                <option value="saas">SaaS</option>
                <option value="ai_tools">AI Tools</option>
                <option value="ecommerce">Ecommerce</option>
                <option value="shopify">Shopify</option>
                <option value="newsletter">Newsletter</option>
                <option value="affiliate">Affiliate</option>
                <option value="chrome_extensions">Chrome Extensions</option>
                <option value="digital_products">Digital Products</option>
              </select>
            </div>
            <Field label="Website URL" name="websiteUrl" placeholder="https://" />
            <Field label="Domain" name="domain" placeholder="example.com" />
            <Field label="Monthly revenue (€)" name="revenue" type="number" required defaultValue="2400" />
            <Field label="Monthly profit (€)" name="profit" type="number" required defaultValue="1700" />
            <Field label="Monthly expenses (€)" name="expenses" type="number" required defaultValue="700" />
            <Field label="Monthly traffic" name="traffic" type="number" required defaultValue="31000" />
            <Field label="Growth rate (%)" name="growth" type="number" required defaultValue="12" />
            <Field label="Asking price (€)" name="askingPrice" type="number" required defaultValue="12500" />
            <Field label="Technology" name="technology" placeholder="Next.js, Mollie…" className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <Label htmlFor="reasonForSelling">Reason for selling</Label>
              <Textarea
                id="reasonForSelling"
                name="reasonForSelling"
                required
                className="mt-1.5"
                defaultValue="Focusing on a new product vertical and want a clean exit."
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Generating…" : "Generate listing & valuation"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="mt-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <h3 className="text-lg font-semibold text-white">
                {result.listing_draft?.title ?? result.listing?.title}
              </h3>
              <p className="text-zinc-400">
                {result.listing_draft?.summary ?? result.listing?.summary}
              </p>
              {(result.listing_draft?.risk_analysis ||
                result.listing?.riskAnalysis) && (
                <p className="text-zinc-300">
                  <Badge variant="warning" className="mr-2">Risk</Badge>
                  {result.listing_draft?.risk_analysis ??
                    result.listing?.riskAnalysis}
                </p>
              )}
              <Badge variant="outline">Seller claims — not verified</Badge>
            </CardContent>
          </Card>

          {result.valuation && (
            <Card>
              <CardHeader>
                <CardTitle>AI Valuation</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-zinc-500">Estimated</p>
                  <p className="text-xl text-white">
                    {formatCurrency(result.valuation.estimated_value)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Range</p>
                  <p className="text-white">
                    {formatCurrency(result.valuation.minimum_value)} –{" "}
                    {formatCurrency(result.valuation.maximum_value)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Confidence</p>
                  <p className="text-white">{result.valuation.confidence}%</p>
                </div>
                <div>
                  <p className="text-zinc-500">AI Score</p>
                  <p className="text-white">{result.valuation.ai_score ?? "—"}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Revenue multiple</p>
                  <p className="text-white">{result.valuation.revenue_multiple ?? "—"}x</p>
                </div>
                <div>
                  <p className="text-zinc-500">Profit multiple</p>
                  <p className="text-white">{result.valuation.profit_multiple ?? "—"}x</p>
                </div>
                <p className="sm:col-span-3 text-xs text-zinc-600">
                  {result.valuation.disclaimer ||
                    result.disclaimer ||
                    VALUATION_DISCLAIMER}
                </p>
              </CardContent>
            </Card>
          )}

          <Button size="lg">Publish listing (connect Supabase to persist)</Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5"
      />
    </div>
  );
}
