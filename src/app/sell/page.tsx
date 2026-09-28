"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

const STEPS = [
  { id: "identity", title: "Business identity" },
  { id: "commercials", title: "Commercials" },
  { id: "assets", title: "Assets & access" },
  { id: "terms", title: "Transfer terms" },
] as const;

function mapValuationCategory(raw: string | null): string {
  switch (raw) {
    case "saas":
      return "saas";
    case "content":
      return "content";
    case "ecommerce":
      return "ecommerce";
    case "app":
      return "web_apps";
    case "newsletter":
      return "newsletter";
    default:
      return "other";
  }
}

export default function SellPage() {
  return (
    <Suspense fallback={<div className="jiy-container py-10 text-muted">Loading…</div>}>
      <SellPageContent />
    </Suspense>
  );
}

function SellPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = useMemo(
    () => ({
      category: mapValuationCategory(searchParams.get("category")),
      revenue: searchParams.get("revenue") ?? "",
      users: searchParams.get("users") ?? "",
      estimateLow: searchParams.get("estimateLow"),
      estimateHigh: searchParams.get("estimateHigh"),
    }),
    [searchParams]
  );
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listingType, setListingType] =
    useState<(typeof LISTING_TYPES)[number]>("BUY");
  const [category, setCategory] = useState(prefill.category);

  const progressValue = ((step + 1) / STEPS.length) * 100;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);

    const name = String(fd.get("name") || "").trim();
    const categoryVal = String(fd.get("category") || category || "other");
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
          category: categoryVal,
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

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="jiy-container max-w-2xl py-8 sm:py-10">
      <p className="sf-label">Intake</p>
      <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
        Sell your business
      </h1>
      <p className="mt-2 text-sm text-muted">
        Submissions stay private until moderation. Claimed metrics remain
        UNVERIFIED until JIY verifies them.
      </p>

      {prefill.estimateLow && prefill.estimateHigh && (
        <p className="mt-4 rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-muted">
          From calculator (estimate only):{" "}
          <span className="font-mono tabular text-foreground">
            {formatCurrency(Number(prefill.estimateLow), "EUR")} –{" "}
            {formatCurrency(Number(prefill.estimateHigh), "EUR")}
          </span>
        </p>
      )}

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="sf-label">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="font-medium text-foreground">{STEPS[step].title}</span>
        </div>
        <Progress value={progressValue} aria-label="Listing intake progress" />
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "jiy-focus-ring rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
                  i === step
                    ? "border-accent bg-accent/15 text-accent"
                    : i < step
                      ? "border-border bg-surface-2 text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={onSubmit} className="mt-10 space-y-8">
        {step === 0 && (
          <StepSection title="Business identity">
            <Field label="Business name" name="name" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Category</Label>
                <input type="hidden" name="category" value={category} />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-1.5">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="listing_type">Type</Label>
                <Select
                  value={listingType}
                  onValueChange={(v) =>
                    setListingType(v as (typeof LISTING_TYPES)[number])
                  }
                >
                  <SelectTrigger id="listing_type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LISTING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                required
                rows={4}
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Domain" name="domain" />
              <Field label="Website URL" name="website_url" type="url" />
            </div>
          </StepSection>
        )}

        {step === 1 && (
          <StepSection title="Commercials">
            <p className="text-xs text-muted">
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
              <Field
                label="Monthly revenue (claimed)"
                name="revenue"
                type="number"
                defaultValue={prefill.revenue}
              />
              <Field label="Monthly profit (claimed)" name="profit" type="number" />
              <Field
                label="Users / traffic (claimed)"
                name="users"
                type="number"
                defaultValue={prefill.users}
              />
            </div>
          </StepSection>
        )}

        {step === 2 && (
          <StepSection title="Assets & access">
            <div>
              <Label htmlFor="assets">Assets included</Label>
              <Textarea id="assets" name="assets" rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="source_code">Source code / access</Label>
              <Textarea
                id="source_code"
                name="source_code"
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="analytics">Analytics access</Label>
              <Textarea
                id="analytics"
                name="analytics"
                rows={2}
                className="mt-1.5"
              />
            </div>
          </StepSection>
        )}

        {step === 3 && (
          <StepSection title="Transfer terms">
            <div>
              <Label htmlFor="transfer_terms">Terms</Label>
              <Textarea
                id="transfer_terms"
                name="transfer_terms"
                rows={3}
                className="mt-1.5"
              />
            </div>
          </StepSection>
        )}

        {error && (
          <p className="rounded-[12px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-[12px] border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {success}
          </p>
        )}

        <div className="sticky bottom-16 z-10 flex flex-wrap gap-3 border-t border-border bg-background/95 py-4 backdrop-blur md:bottom-0">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          <Button type="button" variant="ghost" asChild>
            <Link href="/marketplace">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function StepSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1.5"
      />
    </div>
  );
}
