"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  "saas",
  "ai_tools",
  "ecommerce",
  "content",
  "marketplace",
  "agency",
  "other",
] as const;

const LISTING_TYPES = ["BUY", "RENT", "REVIVE"] as const;

export default function SellPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listingType, setListingType] =
    useState<(typeof LISTING_TYPES)[number]>("BUY");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);

    const name = String(fd.get("name") || "").trim();
    const category = String(fd.get("category") || "other");
    const description = String(fd.get("description") || "").trim();
    const price = fd.get("price") ? Number(fd.get("price")) : undefined;
    const revenue = fd.get("revenue") ? Number(fd.get("revenue")) : undefined;
    const profit = fd.get("profit") ? Number(fd.get("profit")) : undefined;
    const users = fd.get("users") ? Number(fd.get("users")) : undefined;
    const domain = String(fd.get("domain") || "").trim();
    const assets = String(fd.get("assets") || "").trim();
    const sourceCode = String(fd.get("source_code") || "").trim();
    const analytics = String(fd.get("analytics") || "").trim();
    const transferTerms = String(fd.get("transfer_terms") || "").trim();
    const websiteUrl = String(fd.get("website_url") || "").trim();

    try {
      const bizRes = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description,
          website_url: websiteUrl || undefined,
          domain: domain || undefined,
          monthly_revenue: revenue,
          monthly_profit: profit,
          monthly_traffic: users,
          asking_price: price,
          tagline: description.slice(0, 120) || undefined,
          lifecycle: listingType === "RENT" ? "FOR_RENT" : "FOR_SALE",
          publish: false,
        }),
      });
      const bizData = await bizRes.json();
      if (bizRes.status === 401) {
        router.push("/login?next=/sell");
        return;
      }
      if (!bizRes.ok) {
        throw new Error(bizData.error || "Failed to create business");
      }

      const businessId = bizData.business?.id;
      if (!businessId) throw new Error("Business id missing");

      const summaryParts = [
        description,
        assets ? `Assets: ${assets}` : "",
        sourceCode ? `Source: ${sourceCode}` : "",
        analytics ? `Analytics: ${analytics}` : "",
        transferTerms ? `Transfer: ${transferTerms}` : "",
      ].filter(Boolean);

      const listRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          listing_type: listingType,
          title: name,
          summary: summaryParts.join("\n\n"),
          price: listingType === "RENT" ? undefined : price,
          rental_price_monthly: listingType === "RENT" ? price : undefined,
          minimum_rental_months:
            listingType === "RENT" && fd.get("min_term")
              ? Number(fd.get("min_term"))
              : undefined,
          currency: "EUR",
          publish: true,
        }),
      });
      const listData = await listRes.json();
      if (!listRes.ok) {
        throw new Error(listData.error || "Failed to submit listing");
      }

      setSuccess(
        "Listing submitted for review. It will go LIVE after admin verification."
      );
      if (listData.listing?.id) {
        router.push(`/dashboard/listings`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        Sell your business
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Submit a listing for review. Seller-claimed metrics stay UNVERIFIED until
        JIY verifies them. Listings are not public until moderation.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Listing details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" name="name" required className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                defaultValue="saas"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="listing_type">Type</Label>
              <select
                id="listing_type"
                name="listing_type"
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                value={listingType}
                onChange={(e) =>
                  setListingType(e.target.value as (typeof LISTING_TYPES)[number])
                }
              >
                {LISTING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                required
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="price">
                {listingType === "RENT" ? "Monthly price (EUR)" : "Price (EUR)"}
              </Label>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                required
                className="mt-1.5"
              />
            </div>

            {listingType === "RENT" && (
              <div>
                <Label htmlFor="min_term">Minimum term (months)</Label>
                <Input
                  id="min_term"
                  name="min_term"
                  type="number"
                  min={1}
                  className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label htmlFor="revenue">Monthly revenue (claimed)</Label>
              <Input
                id="revenue"
                name="revenue"
                type="number"
                min={0}
                step="0.01"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="profit">Monthly profit (claimed)</Label>
              <Input
                id="profit"
                name="profit"
                type="number"
                step="0.01"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="users">Users / traffic (claimed)</Label>
              <Input
                id="users"
                name="users"
                type="number"
                min={0}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" name="domain" className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                name="website_url"
                type="url"
                placeholder="https://"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="assets">Assets included</Label>
              <Textarea id="assets" name="assets" rows={2} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="source_code">Source code / access</Label>
              <Textarea
                id="source_code"
                name="source_code"
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="analytics">Analytics access</Label>
              <Textarea
                id="analytics"
                name="analytics"
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="transfer_terms">Transfer terms</Label>
              <Textarea
                id="transfer_terms"
                name="transfer_terms"
                rows={2}
                className="mt-1.5"
              />
            </div>

            {error && (
              <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {success}
              </p>
            )}

            <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting…" : "Submit for review"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/marketplace">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
