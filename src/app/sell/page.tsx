"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
        "Listing submitted for review. It goes LIVE only after admin verification."
      );
      router.push("/dashboard/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="sf-label">Intake</p>
      <h1 className="font-display mt-1 text-3xl text-zinc-900 sm:text-4xl">
        Sell your business
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Submissions stay private until moderation. Claimed metrics remain
        UNVERIFIED until JIY verifies them.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-10">
        <Section n="01" title="Business identity">
          <Field label="Business name" name="name" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
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
                className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                value={listingType}
                onChange={(e) =>
                  setListingType(
                    e.target.value as (typeof LISTING_TYPES)[number]
                  )
                }
              >
                {LISTING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={4}
              className="mt-1.5 rounded-md"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Domain" name="domain" />
            <Field label="Website URL" name="website_url" type="url" />
          </div>
        </Section>

        <Section n="02" title="Commercials">
          <p className="text-xs text-zinc-500">
            These figures are seller-claimed until verified.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={
                listingType === "RENT" ? "Monthly price (EUR)" : "Price (EUR)"
              }
              name="price"
              type="number"
              required
            />
            {listingType === "RENT" && (
              <Field label="Minimum term (months)" name="min_term" type="number" />
            )}
            <Field label="Monthly revenue (claimed)" name="revenue" type="number" />
            <Field label="Monthly profit (claimed)" name="profit" type="number" />
            <Field label="Users / traffic (claimed)" name="users" type="number" />
          </div>
        </Section>

        <Section n="03" title="Assets & access">
          <div>
            <Label htmlFor="assets">Assets included</Label>
            <Textarea id="assets" name="assets" rows={2} className="mt-1.5 rounded-md" />
          </div>
          <div>
            <Label htmlFor="source_code">Source code / access</Label>
            <Textarea
              id="source_code"
              name="source_code"
              rows={2}
              className="mt-1.5 rounded-md"
            />
          </div>
          <div>
            <Label htmlFor="analytics">Analytics access</Label>
            <Textarea
              id="analytics"
              name="analytics"
              rows={2}
              className="mt-1.5 rounded-md"
            />
          </div>
        </Section>

        <Section n="04" title="Transfer terms">
          <div>
            <Label htmlFor="transfer_terms">Terms</Label>
            <Textarea
              id="transfer_terms"
              name="transfer_terms"
              rows={3}
              className="mt-1.5 rounded-md"
            />
          </div>
        </Section>

        {error && (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        )}

        <div className="sticky bottom-16 z-10 flex flex-wrap gap-3 border-t border-zinc-200 bg-[#fafaf9]/95 py-4 backdrop-blur md:bottom-0">
          <Button type="submit" disabled={loading}>
            {loading ? "Submitting…" : "Submit for review"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/marketplace">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-200 pt-8">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="tabular text-xs text-zinc-400">{n}</span>
        <h2 className="text-lg font-medium text-zinc-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1.5 rounded-md"
      />
    </div>
  );
}
