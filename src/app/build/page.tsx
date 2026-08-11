"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Factory, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Portfolio {
  activeBuilds: number;
  completed: number;
  growing: number;
  forSale: number;
  rented: number;
  revived: number;
  portfolioValueEur: number;
  estimatedPipelineCost?: {
    aiCostEur: number;
    infraMonthlyEur: number;
  };
  projects: Array<{
    id: string;
    name: string;
    state: string;
    updatedAt: string;
    quality: { overall: number } | null;
  }>;
}

const PIPELINE_PREVIEW = [
  "IDEA",
  "AI",
  "BUILD",
  "TEST",
  "LIVE",
];

export default function BuildFactoryPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costNote, setCostNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/factory/projects")
      .then((r) => r.json())
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const create = await fetch("/api/factory/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: fd.get("idea"),
          budget: fd.get("budget"),
          targetRevenue: fd.get("targetRevenue"),
          country: fd.get("country"),
          targetCustomer: fd.get("targetCustomer"),
          businessType: fd.get("businessType"),
          preferredTechnology: fd.get("preferredTechnology") || undefined,
          experienceLevel: fd.get("experienceLevel") || undefined,
          availableTime: fd.get("availableTime") || undefined,
          riskLevel: fd.get("riskLevel") || undefined,
        }),
      });
      const data = await create.json();
      if (!create.ok) throw new Error(data.error || "Failed to create project");

      setCostNote(
        `Estimated AI cost €${data.estimatedCost.aiCostEur} · infra €${data.estimatedCost.infrastructureMonthlyEur}/mo`
      );

      // Start pipeline immediately (real agent run)
      const run = await fetch(`/api/factory/projects/${data.project.id}/run`, {
        method: "POST",
      });
      const runData = await run.json();
      if (!run.ok) throw new Error(runData.error || "Pipeline failed");

      router.push(`/build/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
            AI Business Factory
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-5xl">
            Build your next business.
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Describe an idea in natural language. SITEFLIP runs a modular agent
            pipeline — blueprint, brand, product, starter landing, tests, and preview.
            Production deploy and payments always require your approval.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Factory className="h-3.5 w-3.5" /> Factory MVP
        </Badge>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-2"
      >
        {PIPELINE_PREVIEW.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {s}
            </span>
            {i < PIPELINE_PREVIEW.length - 1 && (
              <span className="text-zinc-600">↓</span>
            )}
          </div>
        ))}
      </motion.div>

      {/* Portfolio */}
      {portfolio && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active builds", portfolio.activeBuilds],
            ["Completed / live", portfolio.completed],
            ["Growing", portfolio.growing],
            ["Portfolio value", `€${portfolio.portfolioValueEur}`],
            ["For sale", portfolio.forSale],
            ["Rented", portfolio.rented],
            ["Revived", portfolio.revived],
            [
              "Est. build AI cost",
              `€${portfolio.estimatedPipelineCost?.aiCostEur ?? "—"}`,
            ],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              What do you want to build?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="idea">Idea</Label>
                <Textarea
                  id="idea"
                  name="idea"
                  required
                  rows={4}
                  className="mt-1.5"
                  placeholder='Build me a SaaS for small Dutch businesses that helps create invoices. Budget €2,000. Target €1,000 MRR.'
                  defaultValue="Build me a SaaS for small Dutch businesses that helps create invoices."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget" name="budget" defaultValue="€2,000" />
                <Field label="Target revenue" name="targetRevenue" defaultValue="€1,000 MRR" />
                <Field label="Country" name="country" defaultValue="Netherlands" />
                <Field
                  label="Target customer"
                  name="targetCustomer"
                  defaultValue="Small Dutch businesses"
                />
                <div>
                  <Label htmlFor="businessType">Business type</Label>
                  <select
                    id="businessType"
                    name="businessType"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue="SaaS"
                  >
                    {["SaaS", "AI Tool", "Ecommerce", "Newsletter", "Digital Product"].map(
                      (o) => (
                        <option key={o} value={o} className="bg-zinc-900">
                          {o}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <Field
                  label="Preferred technology"
                  name="preferredTechnology"
                  defaultValue="Next.js, Supabase, Stripe"
                />
                <div>
                  <Label htmlFor="experienceLevel">Experience level</Label>
                  <select
                    id="experienceLevel"
                    name="experienceLevel"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue="Intermediate"
                  >
                    {["Beginner", "Intermediate", "Advanced"].map((o) => (
                      <option key={o} value={o} className="bg-zinc-900">
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="availableTime">Available time</Label>
                  <select
                    id="availableTime"
                    name="availableTime"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue="10 hrs/week"
                  >
                    {["5 hrs/week", "10 hrs/week", "20 hrs/week", "Full-time"].map(
                      (o) => (
                        <option key={o} value={o} className="bg-zinc-900">
                          {o}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <Label htmlFor="riskLevel">Risk level</Label>
                  <select
                    id="riskLevel"
                    name="riskLevel"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue="Medium"
                  >
                    {["Low", "Medium", "High"].map((o) => (
                      <option key={o} value={o} className="bg-zinc-900">
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
                The factory does not automatically create any business. Outputs are
                AI-generated, then user-approved. Starter landing ≠ full production SaaS.
                Deploy, domain, and payments require approval.
              </div>

              {costNote && (
                <p className="text-sm text-zinc-400">{costNote}</p>
              )}
              {error && <p className="text-sm text-rose-400">{error}</p>}

              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Running factory pipeline…" : "Start Business Factory"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(portfolio?.projects?.length ?? 0) === 0 && (
                <p className="text-sm text-zinc-500">No factory projects yet.</p>
              )}
              {portfolio?.projects?.map((p) => (
                <Link
                  key={p.id}
                  href={`/build/${p.id}`}
                  className="block rounded-xl border border-white/10 p-3 transition-colors hover:border-violet-500/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white">{p.name}</p>
                    <Badge variant="outline">{p.state}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    AI Score {p.quality?.overall ?? "—"} ·{" "}
                    {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-400">
              <p>• Start with a narrow MVP for one country/customer segment.</p>
              <p>• Approve preview before production deploy.</p>
              <p>• Keep payments inactive until Stripe keys are configured.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        required
        className="mt-1.5"
        defaultValue={defaultValue}
      />
    </div>
  );
}
