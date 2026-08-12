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
import {
  cacheFactoryProject,
  listCachedFactoryProjects,
} from "@/lib/factory/client-cache";
import type { FactoryProject } from "@/lib/factory/types";
import { readCachedProfile } from "@/lib/profile/client-cache";
import type { UserProfile } from "@/lib/profile/types";

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

const PIPELINE_PREVIEW_V5 = [
  "USER IDEA",
  "AI PLAN",
  "GENERATE",
  "SANDBOX",
  "BUILD",
  "TEST",
  "SECURITY",
  "PREVIEW",
  "APPROVAL",
  "DEPLOY",
  "GENERATED APP LIVE",
];

const PIPELINE_PREVIEW_V3 = [
  "PLAN",
  "PRODUCT SPEC",
  "DATABASE SPEC",
  "TECH",
  "GENERATE",
  "BUILD",
  "TEST",
  "SECURITY",
  "PREVIEW",
  "APPROVAL",
];

const PIPELINE_PREVIEW_V2 = [
  "IDEA",
  "ANALYSIS",
  "BLUEPRINT",
  "BRAND",
  "PRODUCT",
  "TECH",
  "LANDING",
  "PASSPORT",
  "AI SCORE",
  "PREVIEW",
  "APPROVAL",
  "READY",
];

export default function BuildFactoryPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cachedProjects] = useState<FactoryProject[]>(() =>
    typeof window === "undefined" ? [] : listCachedFactoryProjects()
  );
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    typeof window === "undefined" ? null : readCachedProfile()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<"v5" | "v3" | "v2">("v5");
  const [costNote, setCostNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/factory/projects")
      .then((r) => r.json())
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile(d.profile);
      })
      .catch(() => null);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      // Explicit form values win; profile only fills blanks
      const idea = String(fd.get("idea") || "");
      const budget =
        String(fd.get("budget") || "").trim() || profile?.budget || undefined;
      const country =
        String(fd.get("country") || "").trim() || profile?.country || undefined;
      const businessType =
        String(fd.get("businessType") || "").trim() ||
        profile?.preferredBusinessType ||
        undefined;
      const riskLevel =
        String(fd.get("riskLevel") || "").trim() || profile?.risk || undefined;
      const workloadPreference =
        String(fd.get("workloadPreference") || "").trim() ||
        profile?.workload ||
        undefined;

      const create = await fetch("/api/factory/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          budget,
          targetRevenue: fd.get("targetRevenue"),
          country,
          targetCustomer: fd.get("targetCustomer"),
          businessType,
          preferredTechnology: fd.get("preferredTechnology") || undefined,
          experienceLevel: fd.get("experienceLevel") || undefined,
          availableTime: fd.get("availableTime") || undefined,
          riskLevel,
          businessModel: fd.get("businessModel") || undefined,
          workloadPreference,
          pipelineVersion: pipelineMode,
          profileContext: profile
            ? {
                country: profile.country,
                budget: profile.budget,
                risk: profile.risk,
                workload: profile.workload,
                preferredBusinessType: profile.preferredBusinessType,
                interests: profile.businessInterests,
                note: "Profile preferences are AI context only — explicit idea overrides them",
              }
            : undefined,
          run: false,
        }),
      });
      const data = await create.json();
      if (!create.ok) throw new Error(data.error || "Failed to create project");

      if (data.fullProject) {
        cacheFactoryProject(data.fullProject);
      }

      setCostNote(
        `Estimated AI cost €${data.estimatedCost.aiCostEur} · infra €${data.estimatedCost.infrastructureMonthlyEur}/mo`
      );

      router.push(`/build/${data.project.id}?autostart=1`);
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
            JIY.APP · AI Business Factory
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-5xl">
            Turn ideas into businesses.
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Describe an idea in natural language. JIY.APP runs the V5 factory:
            Idea → Plan → Generate → Sandbox → Build → Test → Security → Preview →
            Approval → Deploy → Generated App Live. Production Worker isolation and
            Mollie payments always require separate approval.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Factory className="h-3.5 w-3.5" /> Factory V5
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={pipelineMode === "v5" ? "default" : "outline"}
          onClick={() => setPipelineMode("v5")}
        >
          V5 — Idea → Live
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pipelineMode === "v3" ? "default" : "outline"}
          onClick={() => setPipelineMode("v3")}
        >
          V3/V4 — Mini-SaaS
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pipelineMode === "v2" ? "default" : "outline"}
          onClick={() => setPipelineMode("v2")}
        >
          V2 — Landing page
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-2"
      >
        {(pipelineMode === "v5"
          ? PIPELINE_PREVIEW_V5
          : pipelineMode === "v3"
            ? PIPELINE_PREVIEW_V3
            : PIPELINE_PREVIEW_V2
        ).map(
          (s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {s}
            </span>
            {i < arr.length - 1 && (
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
            {profile && (
              <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-zinc-400">
                Using profile preferences as AI context (explicit fields override):{" "}
                {[
                  profile.country && `Country ${profile.country}`,
                  profile.budget && `Budget ${profile.budget}`,
                  profile.risk && `Risk ${profile.risk}`,
                  profile.workload && `Workload ${profile.workload}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "complete your profile for better defaults"}
                .{" "}
                <Link href="/profile" className="text-violet-300 hover:underline">
                  Edit profile
                </Link>
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-4" key={profile?.id || "anon"}>
              <div>
                <Label htmlFor="idea">Idea</Label>
                <Textarea
                  id="idea"
                  name="idea"
                  required
                  rows={4}
                  className="mt-1.5"
                  placeholder='I want an AI booking platform for cleaning companies in the Netherlands.'
                  defaultValue="I want an AI booking platform for cleaning companies in the Netherlands."
                />
              </div>
              <p className="text-xs text-zinc-500">
                Optional details improve the blueprint. Idea alone is enough to start.
                Profile preferences never override your explicit idea.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Budget (optional)"
                  name="budget"
                  defaultValue={profile?.budget || "€2,000"}
                />
                <Field label="Desired revenue (optional)" name="targetRevenue" defaultValue="€1,000 MRR" />
                <Field
                  label="Country (optional)"
                  name="country"
                  defaultValue={profile?.country || "Netherlands"}
                />
                <Field
                  label="Target customer (optional)"
                  name="targetCustomer"
                  defaultValue="Cleaning companies"
                />
                <div>
                  <Label htmlFor="businessType">Business type (optional)</Label>
                  <select
                    id="businessType"
                    name="businessType"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue={profile?.preferredBusinessType || "SaaS"}
                  >
                    {["SaaS", "AI Tool", "Ecommerce", "Newsletter", "Digital Product", "Marketplace"].map(
                      (o) => (
                        <option key={o} value={o} className="bg-zinc-900">
                          {o}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <Field
                  label="Business model"
                  name="businessModel"
                  defaultValue="B2B SaaS subscription"
                />
                <Field
                  label="Preferred technology"
                  name="preferredTechnology"
                  defaultValue="Next.js, Supabase"
                />
                <div>
                  <Label htmlFor="workloadPreference">Workload preference</Label>
                  <select
                    id="workloadPreference"
                    name="workloadPreference"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                    defaultValue={profile?.workload || "Part-time"}
                  >
                    {["Side project", "Part-time", "Full-time"].map((o) => (
                      <option key={o} value={o} className="bg-zinc-900">
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
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
                    defaultValue={profile?.risk || "Medium"}
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
                Factory V1 generates blueprints and a starter landing preview — not a full
                autonomous SaaS. Projects are LOCAL / DEMO / NOT PERSISTED until Supabase
                factory tables are available. Deploy, domain, payments, and marketplace
                publish always require your approval.
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
              {(portfolio?.projects?.length ?? 0) === 0 &&
                cachedProjects.length === 0 && (
                <p className="text-sm text-zinc-500">No factory projects yet.</p>
              )}
              {[
                ...cachedProjects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  state: p.state,
                  updatedAt: p.updatedAt,
                  quality: p.quality,
                })),
                ...(portfolio?.projects ?? []).filter(
                  (p) => !cachedProjects.some((c) => c.id === p.id)
                ),
              ].map((p) => (
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
                    AI Score {p.quality?.overall ?? "—"} · LOCAL/DEMO ·{" "}
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
              <p>• Keep payments inactive until Mollie is configured and approved.</p>
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
