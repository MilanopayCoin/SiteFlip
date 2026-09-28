"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  estimateBusinessValue,
  VALUATION_CATEGORY_LABELS,
  type ValuationCategory,
} from "@/config/valuation";
import { formatCurrency } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { motion, useReducedMotion } from "framer-motion";

export function ValuationCalculator() {
  const reduce = useReducedMotion();
  const [category, setCategory] = useState<ValuationCategory>("saas");
  const [monthlyRevenue, setMonthlyRevenue] = useState("5000");
  const [ageYears, setAgeYears] = useState("2");
  const [monthlyUsers, setMonthlyUsers] = useState("");

  const estimate = useMemo(() => {
    const rev = Number(monthlyRevenue);
    const age = Number(ageYears);
    if (!Number.isFinite(rev) || rev <= 0 || !Number.isFinite(age) || age < 0) {
      return null;
    }
    const users = monthlyUsers.trim()
      ? Number(monthlyUsers)
      : undefined;
    return estimateBusinessValue({
      category,
      monthlyRevenue: rev,
      ageYears: age,
      monthlyUsers: Number.isFinite(users) ? users : undefined,
    });
  }, [category, monthlyRevenue, ageYears, monthlyUsers]);

  const sellHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (monthlyRevenue) params.set("revenue", monthlyRevenue);
    if (ageYears) params.set("age", ageYears);
    if (monthlyUsers.trim()) params.set("users", monthlyUsers.trim());
    if (estimate) {
      params.set("estimateLow", String(estimate.low));
      params.set("estimateHigh", String(estimate.high));
    }
    return `/sell?${params.toString()}`;
  }, [category, monthlyRevenue, ageYears, monthlyUsers, estimate]);

  return (
    <section className="jiy-section border-y border-border bg-surface">
      <div className="jiy-container">
        <SectionHeading
          eyebrow="Valuation"
          title="What is your business worth?"
          subtitle="Rough range from category multiples and the metrics you provide. Not a formal appraisal."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4 rounded-[12px] border border-border bg-background p-6">
            <div className="space-y-2">
              <Label htmlFor="val-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ValuationCategory)}
              >
                <SelectTrigger id="val-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VALUATION_CATEGORY_LABELS) as ValuationCategory[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {VALUATION_CATEGORY_LABELS[key]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="val-revenue">Monthly revenue (€)</Label>
              <Input
                id="val-revenue"
                type="number"
                min={0}
                inputMode="decimal"
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="val-age">Business age (years)</Label>
              <Input
                id="val-age"
                type="number"
                min={0}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="val-users">Monthly users (optional)</Label>
              <Input
                id="val-users"
                type="number"
                min={0}
                value={monthlyUsers}
                onChange={(e) => setMonthlyUsers(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[12px] border border-border bg-surface-2 p-6">
            {estimate ? (
              <>
                <p className="sf-label">Estimated range</p>
                <motion.p
                  key={`${estimate.low}-${estimate.high}`}
                  className="mt-2 font-mono text-3xl tabular text-foreground sm:text-4xl"
                  initial={reduce ? false : { opacity: 0.4, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {formatCurrency(estimate.low, "EUR")} –{" "}
                  {formatCurrency(estimate.high, "EUR")}
                </motion.p>
                <p className="mt-4 text-sm text-muted">
                  Estimate only, not financial advice. JIY does not guarantee sale
                  at this range.
                </p>
                <Button className="mt-8 w-full sm:w-auto" asChild>
                  <Link href={sellHref}>List it on JIY</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted">
                Enter monthly revenue and age to see a rough range.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
