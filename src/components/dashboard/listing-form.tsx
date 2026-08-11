"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

type Biz = { id: string; name: string };

const TYPES = ["BUY", "RENT", "RENT_TO_OWN", "REVIVE", "SELL"] as const;

export function ListingForm() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [type, setType] = useState<(typeof TYPES)[number]>("BUY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => setBusinesses(d.businesses ?? []))
      .catch(() => setBusinesses([]));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>, publish: boolean) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      business_id: String(fd.get("business_id")),
      listing_type: type,
      title: String(fd.get("title")),
      summary: String(fd.get("summary") || ""),
      price: fd.get("price") ? Number(fd.get("price")) : undefined,
      rental_price_monthly: fd.get("rental_price_monthly")
        ? Number(fd.get("rental_price_monthly"))
        : undefined,
      rent_to_own_credit_percent: fd.get("rent_to_own_credit_percent")
        ? Number(fd.get("rent_to_own_credit_percent"))
        : undefined,
      rent_to_own_period_months: fd.get("rent_to_own_period_months")
        ? Number(fd.get("rent_to_own_period_months"))
        : undefined,
      minimum_rental_months: fd.get("minimum_rental_months")
        ? Number(fd.get("minimum_rental_months"))
        : undefined,
      publish,
    };

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(
        publish && data.listing?.id
          ? `/listings/${data.listing.id}`
          : "/dashboard/listings"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (businesses.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6 text-sm text-zinc-400">
          <p>Create a business before listing it on the marketplace.</p>
          <Button asChild>
            <Link href="/dashboard/businesses/new">Create business</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isRent = type === "RENT" || type === "RENT_TO_OWN";

  return (
    <Card>
      <CardContent className="p-6">
        <form className="space-y-4" onSubmit={(e) => submit(e, false)}>
          <div>
            <Label htmlFor="business_id">Business</Label>
            <select
              id="business_id"
              name="business_id"
              required
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="listing_type">Listing type</Label>
            <select
              id="listing_type"
              value={type}
              onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="summary">Description</Label>
            <Textarea id="summary" name="summary" className="mt-1.5" rows={4} />
          </div>
          {!isRent && (
            <div>
              <Label htmlFor="price">Price</Label>
              <Input id="price" name="price" type="number" min={0} className="mt-1.5" />
            </div>
          )}
          {(isRent || type === "BUY" || type === "SELL") && (
            <div>
              <Label htmlFor="rental_price_monthly">Monthly rent (if applicable)</Label>
              <Input
                id="rental_price_monthly"
                name="rental_price_monthly"
                type="number"
                min={0}
                className="mt-1.5"
              />
            </div>
          )}
          {isRent && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="minimum_rental_months">Min months</Label>
                <Input
                  id="minimum_rental_months"
                  name="minimum_rental_months"
                  type="number"
                  min={1}
                  defaultValue={3}
                  className="mt-1.5"
                />
              </div>
              {type === "RENT_TO_OWN" && (
                <>
                  <div>
                    <Label htmlFor="price">Purchase price</Label>
                    <Input id="price" name="price" type="number" min={0} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="rent_to_own_credit_percent">Credit %</Label>
                    <Input
                      id="rent_to_own_credit_percent"
                      name="rent_to_own_credit_percent"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={30}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rent_to_own_period_months">Duration (months)</Label>
                    <Input
                      id="rent_to_own_period_months"
                      name="rent_to_own_period_months"
                      type="number"
                      min={1}
                      defaultValue={12}
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          {type === "RENT_TO_OWN" && (
            <p className="text-xs text-zinc-500">
              Remaining balance estimates are illustrative only. Ownership does not
              transfer automatically.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={loading}>
              Save draft
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={(ev) => {
                const form = (ev.target as HTMLElement).closest("form");
                if (form)
                  submit(
                    {
                      preventDefault() {},
                      currentTarget: form,
                    } as React.FormEvent<HTMLFormElement>,
                    true
                  );
              }}
            >
              Publish listing
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
