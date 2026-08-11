"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/utils";

const CATEGORIES = Object.keys(CATEGORY_LABELS);

const LIFECYCLES = [
  "IDEA",
  "BUILDING",
  "LIVE",
  "GROWING",
  "FOR_SALE",
  "FOR_RENT",
  "REVIVING",
  "ARCHIVED",
] as const;

export function BusinessForm({
  mode = "create",
}: {
  mode?: "create" | "revive";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, publish: boolean) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);

    const payload = {
      name: String(fd.get("name") || ""),
      description: String(fd.get("description") || ""),
      website_url: String(fd.get("website_url") || ""),
      category: String(fd.get("category") || "saas"),
      business_model: String(fd.get("business_model") || ""),
      monthly_revenue: fd.get("monthly_revenue")
        ? Number(fd.get("monthly_revenue"))
        : undefined,
      monthly_profit: fd.get("monthly_profit")
        ? Number(fd.get("monthly_profit"))
        : undefined,
      monthly_traffic: fd.get("monthly_traffic")
        ? Number(fd.get("monthly_traffic"))
        : undefined,
      country: String(fd.get("country") || ""),
      technology: String(fd.get("technology") || ""),
      asking_price: fd.get("asking_price")
        ? Number(fd.get("asking_price"))
        : undefined,
      tagline: String(fd.get("tagline") || ""),
      lifecycle: mode === "revive" ? "REVIVING" : String(fd.get("lifecycle") || "IDEA"),
      publish,
      // revive extras stored in description/tagline for now
      original_story:
        mode === "revive" ? String(fd.get("why_abandoned") || "") : undefined,
    };

    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setNotice(
        data.notice ||
          (publish ? "Business published." : "Draft saved.")
      );
      router.push(`/dashboard/businesses`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form
          className="space-y-4"
          onSubmit={(e) => onSubmit(e, false)}
        >
          <div>
            <Label htmlFor="name">
              {mode === "revive" ? "Project name" : "Business name"}
            </Label>
            <Input id="name" name="name" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline / model</Label>
            <Input id="tagline" name="tagline" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" className="mt-1.5" rows={4} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                name="website_url"
                type="url"
                placeholder="https://"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                defaultValue={mode === "revive" ? "abandoned_saas" : "saas"}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            {mode !== "revive" && (
              <div>
                <Label htmlFor="lifecycle">Status</Label>
                <select
                  id="lifecycle"
                  name="lifecycle"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                  defaultValue="IDEA"
                >
                  {LIFECYCLES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="business_model">Business model</Label>
            <Input id="business_model" name="business_model" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="technology">Technology (comma-separated)</Label>
            <Input
              id="technology"
              name="technology"
              placeholder="Next.js, Supabase, Stripe"
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="monthly_revenue">Monthly revenue</Label>
              <Input
                id="monthly_revenue"
                name="monthly_revenue"
                type="number"
                min={0}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="monthly_profit">Monthly profit</Label>
              <Input
                id="monthly_profit"
                name="monthly_profit"
                type="number"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="monthly_traffic">Monthly traffic</Label>
              <Input
                id="monthly_traffic"
                name="monthly_traffic"
                type="number"
                min={0}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="asking_price">Asking / list price</Label>
            <Input
              id="asking_price"
              name="asking_price"
              type="number"
              min={0}
              className="mt-1.5"
            />
          </div>
          {mode === "revive" && (
            <div>
              <Label htmlFor="why_abandoned">Why abandoned (seller claim)</Label>
              <Textarea
                id="why_abandoned"
                name="why_abandoned"
                className="mt-1.5"
                rows={3}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Labeled as SELLER CLAIM. AI will not invent historical facts.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" variant="secondary" disabled={loading}>
              {loading ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={(ev) => {
                const form = (ev.target as HTMLElement).closest("form");
                if (form) onSubmit({ preventDefault() {}, currentTarget: form } as React.FormEvent<HTMLFormElement>, true);
              }}
            >
              {mode === "revive" ? "Submit revive project" : "Publish"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
