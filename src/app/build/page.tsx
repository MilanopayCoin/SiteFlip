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
import { FastCreateLoader } from "@/components/factory/fast-create-loader";
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
  productionPersistence?: boolean;
  persistenceMode?: string;
  authRequired?: boolean;
  authenticated?: boolean;
  note?: string;
}

/** Default Free-safe path — no TEST/SECURITY/GROWTH in the create Worker call */
const PIPELINE_PREVIEW_V5_FAST = [
  "IDEA",
  "AI GENERATE",
  "SANDBOX",
  "BUILD",
  "PREVIEW",
  "APPROVAL",
  "GENERATED APP LIVE",
];

const PIPELINE_PREVIEW_V5 = [
  "IDEA",
  "AI GENERATE",
  "SANDBOX",
  "BUILD",
  "TEST",
  "SECURITY",
  "PREVIEW",
  "APPROVAL",
  "GENERATED APP LIVE",
  "REAL PRODUCTION ISOLATION",
  "SEPARATE RUNTIME",
  "CUSTOM DOMAIN",
  "MOLLIE",
  "V5 GROWTH",
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
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<"v5" | "v3" | "v2">("v5");
  /** Fast Create is the default on Cloudflare Free (avoids Error 1102). */
  const [createMode, setCreateMode] = useState<"fast" | "full">("fast");
  const [costNote, setCostNote] = useState<string | null>(null);

  const persistenceReady = Boolean(portfolio?.productionPersistence);
  const needsAuth = persistenceReady && authenticated === false;

  useEffect(() => {
    fetch("/api/factory/projects")
      .then(async (r) => {
        const d = await r.json();
        setPortfolio(d);
        if (typeof d.authenticated === "boolean") {
          setAuthenticated(d.authenticated);
        }
      })
      .catch(() => setPortfolio(null));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(Boolean(d.authenticated));
        if (d.profile) setProfile(d.profile);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (needsAuth) {
      setError(
        "Sign in required to create permanent factory projects. DEMO mode is disabled while production persistence is healthy."
      );
      setLoading(false);
      router.push("/login?next=/build");
      return;
    }

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
          // Instant create + run on project page (faster mobile UX, fresh Worker budget)
          run: pipelineMode === "v5" && createMode === "fast" ? false : true,
          fastCreate: pipelineMode === "v5" ? createMode === "fast" : false,
          createMode: pipelineMode === "v5" ? createMode : undefined,
        }),
      });
      const data = await create.json();
      if (!create.ok) {
        if (create.status === 401 || data.code === "AUTH_REQUIRED") {
          setError(
            data.error ||
              "Sign in required to create permanent factory projects."
          );
          router.push(data.loginUrl || "/login?next=/build");
          return;
        }
        throw new Error(data.error || "Failed to create project");
      }

      let full = data.fullProject as FactoryProject | undefined;
      // Cloudflare Free may defer persist after a long in-create pipeline
      if (full && (data.persistDeferred || data.persistOk === false)) {
        const put = await fetch(`/api/factory/projects/${full.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: full }),
        });
        const putData = await put.json().catch(() => ({}));
        if (put.ok && putData.project) full = putData.project;
      }

      if (full) {
        // Mark intended create mode before autostart /run
        if (pipelineMode === "v5" && createMode === "fast") {
          full = {
            ...full,
            sandbox: { ...full.sandbox, createMode: "fast" },
          };
        }
        cacheFactoryProject(full);
      }

      if (data.estimatedCost) {
        setCostNote(
          `Estimated AI cost €${data.estimatedCost.aiCostEur} · infra €${data.estimatedCost.infrastructureMonthlyEur}/mo`
        );
      }

      const projectId = data.project?.id;
      if (!projectId) throw new Error("Create succeeded without project id");

      // Fast Create: jump immediately, run pipeline on project page
      const needsAutostart =
        pipelineMode === "v5" && createMode === "fast"
          ? true
          : !full ||
            full.state === "IDEA" ||
            !(full.outputs && full.outputs.length > 0);
      window.location.href = needsAutostart
        ? `/build/${projectId}?autostart=1`
        : `/build/${projectId}`;
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {loading && (
        <FastCreateLoader
          label={
            pipelineMode === "v5" && createMode === "fast"
              ? "Fast Create in progress"
              : "Building your app"
          }
        />
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
            JIY.APP · AI Business Factory
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-5xl">
            Turn ideas into businesses.
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            {pipelineMode === "v5" && createMode === "fast"
              ? "Fast Create (default): Idea → Generate → Build → Preview → Approval → Live. Built for mobile and Cloudflare Free — skips heavy Test/Security loops that can hit Worker limits."
              : pipelineMode === "v5"
                ? "Full V5: Idea → Generate → Sandbox → Build → Test → Security → Preview → Approval → Live, then the production roadmap (isolation → separate runtime → domain → Mollie → growth). May exceed Free Worker limits."
                : "Describe an idea in natural language. Approve preview before production deploy, domain, or Mollie."}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Factory className="h-3.5 w-3.5" />{" "}
          {pipelineMode === "v5" && createMode === "fast"
            ? "Factory V5 Fast"
            : "Factory V5"}
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

      {pipelineMode === "v5" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={createMode === "fast" ? "default" : "outline"}
            onClick={() => setCreateMode("fast")}
          >
            Fast Create (recommended)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={createMode === "full" ? "default" : "outline"}
            onClick={() => setCreateMode("full")}
          >
            Full V5 (may hit Free limits)
          </Button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-2"
      >
        {(pipelineMode === "v5"
          ? createMode === "fast"
            ? PIPELINE_PREVIEW_V5_FAST
            : PIPELINE_PREVIEW_V5
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

              <div
                className={`rounded-xl border p-3 text-xs ${
                  needsAuth
                    ? "border-rose-500/30 bg-rose-500/5 text-rose-100/90"
                    : persistenceReady
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100/80"
                      : "border-amber-500/20 bg-amber-500/5 text-amber-100/80"
                }`}
              >
                {needsAuth ? (
                  <>
                    <p className="font-medium">
                      Sign in required for permanent V5 factory projects
                    </p>
                    <p className="mt-1">
                      Production Supabase persistence is healthy — DEMO / LOCAL
                      create is disabled. Sign in to save projects permanently.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href="/login?next=/build">Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/signup?next=/build">Create account</Link>
                      </Button>
                    </div>
                  </>
                ) : persistenceReady ? (
                  <>
                    Factory V5 persists projects to Supabase when you are signed
                    in. Default is Fast Create (Idea → Generate → Build →
                    Preview → Approval → Live) so mobile create stays within
                    Cloudflare Free limits. Production isolation, custom domain,
                    and Mollie stay approval-gated.
                  </>
                ) : (
                  <>
                    Factory runs in LOCAL / DEMO until production persistence is
                    healthy. Deploy, domain, payments, and marketplace publish
                    always require your approval.
                  </>
                )}
              </div>

              {costNote && (
                <p className="text-sm text-zinc-400">{costNote}</p>
              )}
              {error && <p className="text-sm text-rose-400">{error}</p>}

              {needsAuth ? (
                <Button asChild size="lg">
                  <Link href="/login?next=/build">
                    Sign in to start Business Factory
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button type="submit" size="lg" disabled={loading}>
                  {loading
                    ? pipelineMode === "v5" && createMode === "fast"
                      ? "Fast Create running…"
                      : "Building your app… keep this screen open"
                    : pipelineMode === "v5" && createMode === "fast"
                      ? "Start Fast Create"
                      : "Start Business Factory"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
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
                    AI Score {p.quality?.overall ?? "—"} ·{" "}
                    {portfolio?.persistenceMode === "SUPABASE"
                      ? "PERSISTED"
                      : "LOCAL/DEMO"}{" "}
                    · {new Date(p.updatedAt).toLocaleString()}
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
        className="mt-1.5"
        defaultValue={defaultValue}
      />
    </div>
  );
}
