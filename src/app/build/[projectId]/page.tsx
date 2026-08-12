"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FactoryProject } from "@/lib/factory/types";
import { PIPELINE_STEPS } from "@/lib/factory/types";
import {
  cacheFactoryProject,
  readCachedFactoryProject,
} from "@/lib/factory/client-cache";

export default function FactoryProjectPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const id = params.projectId;
  const [project, setProject] = useState<FactoryProject | null>(null);
  const [pipeline, setPipeline] = useState(PIPELINE_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const cached = readCachedFactoryProject(id);
    if (cached) setProject(cached);

    let res = await fetch(`/api/factory/projects/${id}`);
    let data = await res.json();

    // Rehydrate LOCAL project into the current Worker isolate
    if (!res.ok && cached) {
      res = await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
      data = await res.json();
    }

    if (!res.ok) {
      if (cached) {
        setError(null);
        return;
      }
      setError(data.error || "Not found");
      return;
    }
    setProject(data.project);
    cacheFactoryProject(data.project);
    setPipeline(data.pipeline ?? PIPELINE_STEPS);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const cached = readCachedFactoryProject(id);
      if (cached && !cancelled) {
        setProject(cached);
        setError(null);
      }
      let res = await fetch(`/api/factory/projects/${id}`);
      let data = await res.json();
      if (!res.ok && cached) {
        res = await fetch(`/api/factory/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: cached }),
        });
        data = await res.json();
      }
      if (cancelled) return;
      if (!res.ok) {
        if (!cached) setError(data.error || "Not found");
        return;
      }
      setError(null);
      setProject(data.project);
      cacheFactoryProject(data.project);
      setPipeline(data.pipeline ?? PIPELINE_STEPS);
    };
    void tick();
    const t = setInterval(() => {
      void tick();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  async function runAgain() {
    setBusy(true);
    setError(null);
    const cached = readCachedFactoryProject(id);
    if (cached) {
      await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
    }
    const res = await fetch(`/api/factory/projects/${id}/run`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.project) {
      cacheFactoryProject(data.project);
      setProject(data.project);
    } else {
      setError(
        data.error ||
          "Pipeline failed — re-create from /build (LOCAL memory is isolate-scoped)"
      );
    }
    await load();
    setBusy(false);
  }

  // Auto-start pipeline once after create (?autostart=1)
  useEffect(() => {
    if (autoStarted.current) return;
    if (searchParams.get("autostart") !== "1") return;
    if (!project || project.outputs.length > 0) return;
    if (project.state !== "IDEA") return;
    autoStarted.current = true;
    const t = window.setTimeout(() => {
      void runAgain();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, searchParams]);

  async function decide(approvalId: string, decision: "APPROVE" | "EDIT" | "CANCEL") {
    setBusy(true);
    const cached = readCachedFactoryProject(id);
    if (cached) {
      await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
    }
    const res = await fetch(`/api/factory/projects/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision }),
    });
    const data = await res.json();
    if (res.ok && data.project) {
      cacheFactoryProject(data.project);
      setProject(data.project);
    }
    await load();
    setBusy(false);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-rose-400">{error}</p>
        <Button className="mt-4" asChild>
          <Link href="/build">Back to Factory</Link>
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading factory project…
      </div>
    );
  }

  const pending = project.approvals.filter((a) => a.status === "PENDING");
  const isLive = project.state === "LIVE";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
            Business Factory
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
            {project.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{project.state}</Badge>
            <Badge variant="info">Step {project.currentStep ?? "—"}</Badge>
            {project.quality && (
              <Badge variant="success">
                AI Score {project.quality.overall}/100
              </Badge>
            )}
            <Badge variant="warning">
              {project.persistenceMode === "SUPABASE"
                ? "PERSISTED"
                : "LOCAL / DEMO / NOT PERSISTED"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/build/${id}/preview`}>Open Preview</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/build/${id}/passport`}>Business Passport</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/build/${id}/command`}>AI Command Center</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/build/${id}/sell`}>BUILD → SELL</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/build/${id}/rent`}>BUILD → RENT</Link>
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={runAgain}>
            Re-run pipeline
          </Button>
        </div>
      </div>

      {/* Pipeline visualization */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Factory pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pipeline.map((step, i) => {
              const task = project.tasks.find((t) => t.stepId === step.id);
              const status = task?.status ?? "WAITING";
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{step.number}</span>
                    <StatusIcon status={status} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">{step.label}</p>
                  <p className="text-[11px] text-zinc-500">{step.agent}</p>
                  <Progress value={task?.progress ?? 0} className="mt-2 h-1" />
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    {status}
                  </p>
                  {task?.activity && (
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                      {task.activity}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Activity log</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-3 overflow-y-auto">
            {project.activityLog.map((a) => (
              <div key={a.id} className="border-l border-white/10 pl-3 text-sm">
                <p className="text-xs text-zinc-500">
                  {new Date(a.at).toLocaleTimeString()} · {a.agent}
                </p>
                <p
                  className={
                    a.level === "error"
                      ? "text-rose-300"
                      : a.level === "success"
                        ? "text-emerald-300"
                        : a.level === "warning"
                          ? "text-amber-300"
                          : "text-zinc-300"
                  }
                >
                  {a.message}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Outputs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Agent outputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.outputs.length === 0 && (
              <p className="text-sm text-zinc-500">No outputs yet.</p>
            )}
            {[...project.outputs].reverse().map((o) => (
              <details
                key={o.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-white">
                  {o.agent} · {o.schemaName} · {o.implementationStatus}
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-zinc-400">
                  {JSON.stringify(o.data, null, 2)}
                </pre>
                {o.labeledAssumptions.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-200/80">
                    {o.labeledAssumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Approvals */}
      {pending.length > 0 && (
        <Card className="mt-6 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Approval required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
              >
                <h3 className="font-medium text-white">{a.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{a.explanation}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Services: {a.services.join(", ") || "—"} · Est. cost:{" "}
                  {a.estimatedCostEur != null ? `€${a.estimatedCostEur}` : "—"}
                </p>
                <ul className="mt-2 list-disc pl-4 text-xs text-zinc-500">
                  {a.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => decide(a.id, "APPROVE")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => decide(a.id, "EDIT")}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => decide(a.id, "CANCEL")}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Landing preview strip */}
      {(() => {
        const content = project.outputs.find((o) => o.agent === "ContentAgent")
          ?.data as
          | {
              hero?: { headline: string; subheadline: string; cta: string };
              features?: Array<{ title: string; body: string }>;
            }
          | undefined;
        const brand = project.outputs.find((o) => o.agent === "BrandAgent")
          ?.data as { brandName?: string } | undefined;
        if (!content?.hero) return null;
        return (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>Landing preview</span>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/build/${id}/preview`}>Open full preview</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
                  {brand?.brandName || project.name}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {content.hero.headline}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
                  {content.hero.subheadline}
                </p>
                <p className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">
                  {content.hero.cta}
                </p>
                {content.features && content.features.length > 0 && (
                  <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                    {content.features.slice(0, 3).map((f) => (
                      <div
                        key={f.title}
                        className="rounded-lg border border-white/10 p-3"
                      >
                        <p className="text-sm font-medium text-white">{f.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{f.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Starter landing only · Mollie payments inactive · LOCAL / DEMO /
                NOT PERSISTED
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Handoff */}
      {isLive && (
        <Card className="mt-6 border-emerald-500/30">
          <CardContent className="p-6 sm:p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
              Your business is live
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {project.name}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-zinc-500">URL</p>
                <p className="text-zinc-200">
                  {project.sandbox.productionUrl || project.sandbox.previewUrl}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">AI Score</p>
                <p className="text-zinc-200">{project.quality?.overall ?? "—"}/100</p>
              </div>
              <div>
                <p className="text-zinc-500">Monthly operating cost (est.)</p>
                <p className="text-zinc-200">
                  €{project.usage.infrastructureMonthlyEur}/mo
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={project.sandbox.productionUrl || `/build/${id}/preview`}>
                  Open business
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/build/${id}/command`}>Grow business</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/build/${id}/sell`}>List on SITEFLIP</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href={`/build/${id}/rent`}>Rent my business</Link>
              </Button>
            </div>
            {project.growthPlan && (
              <div className="mt-6">
                <p className="text-sm font-medium text-white">90-day growth plan</p>
                <ul className="mt-2 grid gap-1 text-sm text-zinc-400 sm:grid-cols-2">
                  {project.growthPlan.slice(0, 8).map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Costs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cost tracking</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-zinc-500">AI cost (est.)</p>
            <p className="text-white">€{project.usage.aiCostEurEstimated}</p>
          </div>
          <div>
            <p className="text-zinc-500">Tokens (est.)</p>
            <p className="text-white">
              {project.usage.aiTokensEstimated.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Infra / mo (est.)</p>
            <p className="text-white">€{project.usage.infrastructureMonthlyEur}</p>
          </div>
          <div>
            <p className="text-zinc-500">Threshold</p>
            <p className="text-white">€{project.usage.costThresholdEur}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quality breakdown */}
      {project.quality && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>AI Score — {project.quality.overall}/100</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {(
                [
                  ["marketClarity", project.quality.marketClarity],
                  ["problemStrength", project.quality.problemStrength],
                  ["businessModel", project.quality.businessModel],
                  ["competition", project.quality.competition],
                  ["executionComplexity", project.quality.executionComplexity],
                  ["growthPotential", project.quality.growthPotential],
                  ["risk", project.quality.risk],
                  ["completeness", project.quality.completeness],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-xs capitalize text-zinc-500">
                    {k.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="text-white">{v}/100</p>
                </div>
              ))}
            </div>
            {project.quality.explanations?.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-400">
                {project.quality.explanations.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {project.passport && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Business Passport</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-zinc-500">
              ID: <span className="font-mono text-zinc-300">{project.passport.businessId}</span>
            </p>
            <p className="text-zinc-500">
              Lifecycle:{" "}
              <span className="text-zinc-300">{project.passport.lifecycle}</span>
            </p>
            <p className="text-zinc-500">
              Model:{" "}
              <span className="text-zinc-300">{project.passport.businessModel}</span>
            </p>
            <p className="text-zinc-500">
              Customer:{" "}
              <span className="text-zinc-300">{project.passport.targetCustomer}</span>
            </p>
            <p className="sm:col-span-2 text-xs text-amber-200/80">
              {project.passport.persistenceNote}
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/build/${id}/passport`}>Open full passport</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "RUNNING")
    return <Loader2 className="h-4 w-4 animate-spin text-violet-400" />;
  if (status === "FAILED") return <XCircle className="h-4 w-4 text-rose-400" />;
  if (status === "REQUIRES_APPROVAL")
    return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Circle className="h-4 w-4 text-zinc-600" />;
}
