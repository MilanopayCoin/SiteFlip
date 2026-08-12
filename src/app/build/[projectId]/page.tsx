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
import { getPipelineSteps } from "@/lib/factory/types";
import {
  cacheFactoryProject,
  readCachedFactoryProject,
} from "@/lib/factory/client-cache";
import type { CodeArtifact, SecurityScan, TestReport } from "@/lib/factory/schemas";

  const WORKSPACE_TABS = [
  "Overview",
  "Pipeline",
  "Generated App",
  "Files",
  "Build Logs",
  "Tests",
  "Security",
  "Preview",
  "Deployment",
  "Cost",
  "Passport",
  "Approval",
] as const;

type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export default function FactoryProjectPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const id = params.projectId;
  const [project, setProject] = useState<FactoryProject | null>(null);
  const [pipeline, setPipeline] = useState(getPipelineSteps("v3"));
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("Overview");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">(
    "loading"
  );
  const [deployments, setDeployments] = useState<
    Array<{
      deploymentId: string;
      version: string;
      status: string;
      previewUrl: string | null;
      productionUrl: string | null;
      healthCheckPassed: boolean | null;
      verifiedAt: string | null;
      error: string | null;
      notes: string[];
      createdAt: string;
    }>
  >([]);
  const [deployMeta, setDeployMeta] = useState<{
    productionGate?: { ok: boolean; blockers: string[] };
    isolation?: { blockProduction?: boolean; message?: string };
  } | null>(null);
  const [postLive, setPostLive] = useState<{
    youAreHereLabel: string;
    currentMarker: string;
    nextActionable: string | null;
    gates: Array<{
      id: string;
      label: string;
      status: string;
      note: string;
      blockers: string[];
    }>;
  } | null>(null);
  const [domains, setDomains] = useState<
    Array<{ domain: string; status: string; notes?: string[] }>
  >([]);
  const [domainInput, setDomainInput] = useState("");
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const cached = readCachedFactoryProject(id);
    if (cached) {
      setProject(cached);
      setLoadState("ready");
    }

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
        setLoadState("ready");
        return;
      }
      setError(
        data.error ||
          "Project not found. LOCAL / DEMO projects only exist in this browser session — create a new one from /build."
      );
      setLoadState("missing");
      return;
    }
    setProject(data.project);
    cacheFactoryProject(data.project);
    setPipeline(data.pipeline ?? getPipelineSteps(data.project?.pipelineVersion ?? "v3"));
    setError(null);
    setLoadState("ready");
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      // Do not poll-overwrite UI or rehydrate while pipeline is running
      if (busy) return;
      const cached = readCachedFactoryProject(id);
      if (cached && !cancelled) {
        setProject(cached);
        setError(null);
        setLoadState("ready");
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
      if (cancelled || busy) return;
      if (!res.ok) {
        if (!cached) {
          setError(
            data.error ||
              "Project not found. LOCAL / DEMO projects only exist in this browser session — create a new one from /build."
          );
          setLoadState("missing");
        }
        return;
      }
      setError(null);
      setProject(data.project);
      cacheFactoryProject(data.project);
      setPipeline(data.pipeline ?? getPipelineSteps(data.project?.pipelineVersion ?? "v3"));
      setLoadState("ready");
    };
    void tick();
    const failSafe = window.setTimeout(() => {
      if (cancelled) return;
      setLoadState((s) => {
        if (s === "loading") {
          setError(
            "Could not load this factory project. It may be LOCAL / DEMO / NOT PERSISTED and unavailable in this session."
          );
          return "missing";
        }
        return s;
      });
    }, 8000);
    const t = setInterval(() => {
      void tick();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.clearTimeout(failSafe);
    };
  }, [id, busy]);

  async function runAgain() {
    setBusy(true);
    setError(null);
    const cached = readCachedFactoryProject(id);
    // Only hydrate isolate when project is missing (404). Never PUT a stale
    // client cache over a live Supabase project — that wiped GENERATE outputs.
    let res = await fetch(`/api/factory/projects/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: cached ?? project }),
    });
    if (res.status === 404 && cached) {
      await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
      res = await fetch(`/api/factory/projects/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      });
    }
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

  const loadDeployments = useCallback(async () => {
    const res = await fetch(`/api/factory/projects/${id}/deploy`);
    if (!res.ok) return;
    const data = await res.json();
    setDeployments(data.deployments || []);
    setDeployMeta({
      productionGate: data.productionGate,
      isolation: data.isolation,
    });
  }, [id]);

  const loadDomains = useCallback(async () => {
    const res = await fetch(`/api/factory/projects/${id}/domains`);
    if (!res.ok) return;
    const data = await res.json();
    setDomains(data.domains || []);
  }, [id]);

  const loadPostLive = useCallback(async () => {
    const cached = readCachedFactoryProject(id);
    // Ensure isolate has project for GET
    if (cached?.pipelineVersion === "v5") {
      await fetch(`/api/factory/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: cached }),
      }).catch(() => null);
    }
    const res = await fetch(`/api/factory/projects/${id}/post-live`);
    if (!res.ok) {
      setPostLive(null);
      return;
    }
    const data = await res.json();
    setPostLive({
      youAreHereLabel: data.snapshot?.youAreHereLabel || data.youAreHere,
      currentMarker: data.snapshot?.currentMarker || "LIVE",
      nextActionable: data.snapshot?.nextActionable || null,
      gates: data.snapshot?.gates || [],
    });
  }, [id]);

  useEffect(() => {
    if (workspaceTab !== "Deployment") return;
    const t = window.setTimeout(() => {
      void loadDeployments();
      void loadDomains();
      void loadPostLive();
    }, 0);
    return () => window.clearTimeout(t);
  }, [workspaceTab, loadDeployments, loadDomains, loadPostLive]);

  async function attemptPostLiveGate(stepId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/factory/projects/${id}/post-live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId,
        project: readCachedFactoryProject(id) || project,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || data.message || "Post-live gate failed");
    } else if (data.project) {
      setProject(data.project);
      cacheFactoryProject(data.project);
      setPostLive({
        youAreHereLabel: data.snapshot?.youAreHereLabel || data.youAreHere,
        currentMarker: data.snapshot?.currentMarker || "LIVE",
        nextActionable: data.snapshot?.nextActionable || null,
        gates: data.snapshot?.gates || [],
      });
      if (!data.ok && data.message) setError(data.message);
    }
    await load();
    setBusy(false);
  }

  async function deployAction(action: "preview" | "production" | "rollback", targetDeploymentId?: string) {
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
    const res = await fetch(`/api/factory/projects/${id}/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetDeploymentId,
        project: cached ?? project,
      }),
    });
    const data = await res.json();
    if (data.project) {
      cacheFactoryProject(data.project);
      setProject(data.project);
    }
    if (!res.ok || data.blocked) {
      setError(
        data.message ||
          data.error ||
          "PRODUCTION ISOLATION REQUIRED — production deploy blocked"
      );
    }
    await load();
    await loadDeployments();
    setBusy(false);
  }

  async function domainAction(
    action: "add" | "verify" | "connect" | "remove",
    domain?: string
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/factory/projects/${id}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        domain: domain || domainInput,
        project: readCachedFactoryProject(id) ?? project,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Domain action failed");
    }
    if (action === "add") setDomainInput("");
    await loadDomains();
    setBusy(false);
  }

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
      body: JSON.stringify({
        approvalId,
        decision,
        project: cached ?? project,
      }),
    });
    const data = await res.json();
    if (res.ok && data.project) {
      cacheFactoryProject(data.project);
      setProject(data.project);
    }
    await load();
    setBusy(false);
  }

  if (error || loadState === "missing") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-rose-400">
          {error || "Factory project not found."}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          LOCAL / DEMO / NOT PERSISTED — projects are not stored in Supabase yet.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/build">Back to Factory</Link>
        </Button>
      </div>
    );
  }

  if (!project || loadState === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading factory project…
      </div>
    );
  }

  const pending = project.approvals.filter((a) => a.status === "PENDING");
  const isLive = project.state === "LIVE";
  const failedTasks = project.tasks.filter((t) => t.status === "FAILED");
  const code = project.outputs.find((o) => o.agent === "DeveloperAgent")
    ?.data as CodeArtifact | undefined;
  const tests = project.outputs.find((o) => o.agent === "TestingAgent")
    ?.data as TestReport | undefined;
  const security = project.outputs.find((o) => o.agent === "SecurityAgent")
    ?.data as SecurityScan | undefined;
  const isV3 = project.pipelineVersion === "v3" || project.pipelineVersion === "v4" || project.pipelineVersion === "v5";
  const versionLabel =
    project.pipelineVersion === "v5"
      ? "V5"
      : project.pipelineVersion === "v4"
        ? "V4"
        : project.pipelineVersion === "v3"
          ? "V3"
          : "V2";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
            Business Factory {versionLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
            {project.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{project.state}</Badge>
            <Badge variant="info">Step {project.currentStep ?? "—"}</Badge>
            {isV3 && (
              <Badge variant="info">AI GENERATED STARTER</Badge>
            )}
            {project.pipelineVersion === "v5" && project.state === "LIVE" && (
              <Badge variant="success">GENERATED APP LIVE</Badge>
            )}
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

      {/* V3 workspace tabs — mobile-first horizontal scroll */}
      <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setWorkspaceTab(tab)}
              className={`rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition ${
                workspaceTab === tab
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {(workspaceTab === "Overview" || workspaceTab === "Pipeline") && (
      <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Factory pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pipeline.map((step, i) => {
              const task = project.tasks.find((t) => t.stepId === step.id);
              let status = task?.status ?? "WAITING";
              // Honest Free-tier display: never green-check isolation/runtime as done
              if (
                (step.id === "PRODUCTION_ISOLATION" ||
                  step.id === "SEPARATE_RUNTIME") &&
                status === "COMPLETED" &&
                !project.sandbox.isProductionGrade
              ) {
                status = "FAILED";
              }
              const activity =
                step.id === "PRODUCTION_ISOLATION" &&
                (status === "WAITING" || status === "FAILED")
                  ? "BLOCKED on Cloudflare Free — SANDBOX: DEVELOPMENT ISOLATION only"
                  : step.id === "SEPARATE_RUNTIME" &&
                      (status === "WAITING" || status === "FAILED")
                    ? "LOCKED until real production isolation"
                    : task?.activity;
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
                    <StatusIcon
                      status={
                        step.id === "PRODUCTION_ISOLATION" &&
                        status !== "COMPLETED"
                          ? "BLOCKED"
                          : step.id === "SEPARATE_RUNTIME" &&
                              status !== "COMPLETED"
                            ? "LOCKED"
                            : status
                      }
                    />
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">{step.label}</p>
                  <p className="text-[11px] text-zinc-500">{step.agent}</p>
                  <Progress value={task?.progress ?? 0} className="mt-2 h-1" />
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    {step.id === "PRODUCTION_ISOLATION" && status !== "COMPLETED"
                      ? "BLOCKED"
                      : step.id === "SEPARATE_RUNTIME" && status !== "COMPLETED"
                        ? "LOCKED"
                        : status}
                  </p>
                  {activity && (
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                      {activity}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {workspaceTab === "Overview" && failedTasks.length > 0 && (
        <Card className="mt-6 border-rose-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-300">
              <XCircle className="h-5 w-5" />
              Failed stages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedTasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm"
              >
                <p className="font-medium text-white">
                  {t.stepId} · {t.agent}
                </p>
                <p className="mt-1 text-zinc-400">
                  {t.error || t.activity || "Stage failed"}
                </p>
              </div>
            ))}
            <Button size="sm" disabled={busy} onClick={runAgain}>
              Retry pipeline
            </Button>
          </CardContent>
        </Card>
      )}

      {(workspaceTab === "Overview" || workspaceTab === "Generated App") && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
                  {o.source === "heuristic" ? " · HEURISTIC / AI FALLBACK" : ` · ${o.source}`}
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
      )}

      {workspaceTab === "Files" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Generated files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!code?.files?.length && (
              <p className="text-sm text-zinc-500">No generated files yet.</p>
            )}
            {code?.files?.map((f) => (
              <div
                key={f.path}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm"
              >
                <p className="font-mono text-violet-300">{f.path}</p>
                <p className="text-xs text-zinc-500">{f.purpose} · {f.language}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Build Logs" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Build logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs text-zinc-400">
              {project.sandbox.buildLogs.map((log, i) => (
                <li key={i}>{log}</li>
              ))}
              {project.sandbox.buildLogs.length === 0 && (
                <li className="text-zinc-500">No build logs yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Tests" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              Test status — {tests?.passed ? "PASS" : tests ? "FAIL / REVIEW" : "NOT RUN"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!tests && <p className="text-sm text-zinc-500">Tests not run yet.</p>}
            {tests?.checks?.map((c) => (
              <div key={c.name} className="flex justify-between text-sm">
                <span className="text-zinc-300">{c.name}</span>
                <span
                  className={
                    c.status === "pass"
                      ? "text-emerald-400"
                      : c.status === "fail"
                        ? "text-rose-400"
                        : "text-zinc-500"
                  }
                >
                  {c.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Security" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              Security status —{" "}
              {security?.passed
                ? "PASS"
                : security
                  ? "REQUIRES APPROVAL"
                  : "NOT RUN"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!security && <p className="text-sm text-zinc-500">Security scan not run yet.</p>}
            {security?.findings?.map((f, i) => (
              <div key={i} className="rounded-lg border border-white/10 p-3 text-sm">
                <p className="text-amber-300">
                  [{f.severity}] {f.category}
                </p>
                <p className="text-zinc-400">{f.detail}</p>
                {f.file && <p className="font-mono text-xs text-zinc-500">{f.file}</p>}
              </div>
            ))}
            {security?.passed && (
              <p className="text-sm text-emerald-400">No critical security findings.</p>
            )}
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Preview" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Preview — AI GENERATED STARTER</span>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/build/${id}/preview`}>Open full preview</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-zinc-500">Build status:</span>{" "}
              <span className="text-white">{project.sandbox.deploymentStatus}</span>
            </p>
            <p>
              <span className="text-zinc-500">Test status:</span>{" "}
              <span className="text-white">
                {tests?.passed ? "PASS" : tests?.requiresHumanApproval ? "REQUIRES_HUMAN_REVIEW" : tests ? "FAIL" : "—"}
              </span>
            </p>
            <p>
              <span className="text-zinc-500">Security status:</span>{" "}
              <span className="text-white">
                {security?.passed ? "PASS" : security?.requiresApproval ? "REQUIRES_APPROVAL" : "—"}
              </span>
            </p>
            <p>
              <span className="text-zinc-500">Completeness:</span>{" "}
              <span className="text-white">{code?.completeness ?? "—"}</span>
            </p>
            <p className="text-xs text-zinc-500">
              SANDBOX: DEVELOPMENT ISOLATION · Generated apps are NOT auto-deployed
            </p>
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Deployment" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {project.pipelineVersion === "v5"
                ? "Deployment — JIY.APP V5"
                : "Deployment — JIY.APP V4.4"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {project.pipelineVersion === "v5" && postLive && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
                <p className="font-medium text-rose-200">
                  🔴 ŞU AN BURASI · {postLive.youAreHereLabel}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Marker: {postLive.currentMarker}
                  {postLive.nextActionable
                    ? ` · Next gate: ${postLive.nextActionable}`
                    : ""}
                </p>
                <div className="mt-3 space-y-2">
                  {postLive.gates.map((g) => (
                    <div
                      key={g.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-200">
                          {g.status === "COMPLETED"
                            ? "✓"
                            : g.id === postLive.nextActionable
                              ? "→"
                              : "·"}{" "}
                          {g.label}{" "}
                          <span className="text-xs text-zinc-500">
                            [{g.status}]
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500">{g.note}</p>
                      </div>
                      {(g.status === "AVAILABLE" || g.status === "BLOCKED") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => attemptPostLiveGate(g.id)}
                        >
                          Check
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="font-medium text-amber-200">
                PRODUCTION ISOLATION REQUIRED
              </p>
              <p className="mt-1 text-zinc-400">
                {deployMeta?.isolation?.message ||
                  "Current mode is SANDBOX: DEVELOPMENT ISOLATION. Generated apps are not deployed into the main JIY.APP Worker. Production LIVE is blocked until separate Worker identities and resource isolation exist."}
              </p>
              {deployMeta?.productionGate && !deployMeta.productionGate.ok && (
                <p className="mt-2 text-xs text-amber-300/90">
                  Gate blockers: {deployMeta.productionGate.blockers.join(" · ")}
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-zinc-500">Preview URL</p>
                <p className="break-all text-zinc-200">
                  {project.sandbox.previewUrl || `/build/${id}/preview`}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Production URL</p>
                <p className="text-zinc-200">
                  {project.sandbox.productionUrl || "NOT DEPLOYED"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Deployment status</p>
                <p className="text-white">{project.sandbox.deploymentStatus}</p>
              </div>
              <div>
                <p className="text-zinc-500">Platform</p>
                <p className="text-white">https://jiy.app</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => deployAction("preview")}>
                Deploy preview
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => deployAction("production")}
              >
                DEPLOY MY BUSINESS
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/build/${id}/preview`}>Open preview</Link>
              </Button>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <p className="font-medium text-zinc-200">Deployment versions</p>
              {deployments.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No deployments yet — deploy preview to create a version record.
                </p>
              ) : (
                <ul className="space-y-2">
                  {deployments.map((d) => (
                    <li
                      key={d.deploymentId}
                      className="rounded-lg border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={d.status === "LIVE" ? "success" : "outline"}>
                          {d.status}
                        </Badge>
                        <span className="text-xs text-zinc-400">{d.version}</span>
                        <span className="text-xs text-zinc-600">{d.deploymentId}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Health:{" "}
                        {d.healthCheckPassed === true
                          ? "PASS"
                          : d.healthCheckPassed === false
                            ? "FAIL"
                            : "—"}
                        {d.verifiedAt ? ` · verified ${d.verifiedAt}` : ""}
                      </p>
                      {d.error && (
                        <p className="mt-1 text-xs text-rose-400">{d.error}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => deployAction("rollback", d.deploymentId)}
                        >
                          Request rollback
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <p className="font-medium text-zinc-200">Domains</p>
              <p className="text-xs text-zinc-500">
                Architecture supports businessname.jiy.app and custom domains. DNS is
                never auto-modified — verification uses DNS-over-HTTPS only.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                  placeholder="custom.example.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !domainInput.trim()}
                  onClick={() => domainAction("add")}
                >
                  Add domain
                </Button>
              </div>
              {domains.length === 0 ? (
                <p className="text-xs text-zinc-500">No domains registered.</p>
              ) : (
                <ul className="space-y-2">
                  {domains.map((d) => (
                    <li
                      key={d.domain}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-2"
                    >
                      <span className="text-zinc-200">{d.domain}</span>
                      <Badge variant="outline">{d.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => domainAction("verify", d.domain)}
                      >
                        Verify DNS
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => domainAction("connect", d.domain)}
                      >
                        Connect
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => domainAction("remove", d.domain)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-zinc-500">
              AI GENERATED STARTER · Approval required before production attempt ·
              LIVE only after health verification · Mollie not auto-connected · Domain
              DNS never auto-modified
            </p>
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Cost" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>ESTIMATED BUILD COST</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-zinc-500">AI cost (est.)</p>
              <p className="text-white">€{project.usage.aiCostEurEstimated}</p>
            </div>
            <div>
              <p className="text-zinc-500">AI requests</p>
              <p className="text-white">{project.usage.aiRequestCount}</p>
            </div>
            <div>
              <p className="text-zinc-500">Build attempts</p>
              <p className="text-white">{project.usage.buildAttempts}</p>
            </div>
            <div>
              <p className="text-zinc-500">Infra / mo (est.)</p>
              <p className="text-white">€{project.usage.infrastructureMonthlyEur}</p>
            </div>
            <div>
              <p className="text-zinc-500">Threshold</p>
              <p className="text-white">€{project.usage.costThresholdEur}</p>
            </div>
            <div>
              <p className="text-zinc-500">Budget remaining</p>
              <p className="text-white">
                {project.usage.budgetLimitEur == null
                  ? "N/A — no budget set"
                  : `€${Math.max(
                      0,
                      project.usage.budgetLimitEur -
                        project.usage.aiCostEurEstimated
                    ).toFixed(2)}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Passport" && project.passport && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Business Passport</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-zinc-500">
              Version:{" "}
              <span className="text-zinc-300">{project.passport.applicationVersion}</span>
            </p>
            <p className="text-zinc-500">
              Build: <span className="text-zinc-300">{project.passport.buildStatus}</span>
            </p>
            <p className="text-zinc-500">
              Tests: <span className="text-zinc-300">{project.passport.testStatus}</span>
            </p>
            <p className="text-zinc-500">
              Security:{" "}
              <span className="text-zinc-300">{project.passport.securityStatus}</span>
            </p>
            <p className="sm:col-span-2 text-zinc-500">
              Features:{" "}
              <span className="text-zinc-300">
                {project.passport.features?.join(", ") || "—"}
              </span>
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/build/${id}/passport`}>Open full passport</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {(workspaceTab === "Overview" || workspaceTab === "Approval") &&
      pending.length > 0 && (
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
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => decide(a.id, "CANCEL")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {workspaceTab === "Overview" && (
      <>
      {isV3 && code?.files?.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Starter MVP — AI GENERATED STARTER</span>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/build/${id}/preview`}>Open preview</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {code.files
                .filter((f) => f.path.includes("/app/") && f.path.endsWith("page.tsx"))
                .map((f) => (
                  <div
                    key={f.path}
                    className="rounded-lg border border-white/10 p-3 text-sm"
                  >
                    <p className="font-medium text-white">
                      {f.path.split("/").slice(-2, -1)[0] || "Landing"}
                    </p>
                    <p className="text-xs text-zinc-500">{f.purpose}</p>
                  </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              {code.completeness} · SANDBOX: DEVELOPMENT ISOLATION · Mollie inactive ·
              LOCAL / DEMO / NOT PERSISTED
            </p>
          </CardContent>
        </Card>
      ) : (
      (() => {
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
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Starter landing only · Mollie payments inactive · LOCAL / DEMO /
                NOT PERSISTED
              </p>
            </CardContent>
          </Card>
        );
      })()
      )}

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
                <Link href={`/build/${id}/sell`}>List on JIY.APP</Link>
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
          <div>
            <p className="text-zinc-500">Budget remaining</p>
            <p className="text-white">
              {project.usage.budgetLimitEur == null
                ? "N/A — no budget set"
                : `€${Math.max(
                    0,
                    project.usage.budgetLimitEur -
                      project.usage.aiCostEurEstimated
                  ).toFixed(2)}`}
            </p>
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
      </>
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
  if (status === "BLOCKED" || status === "LOCKED")
    return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Circle className="h-4 w-4 text-zinc-600" />;
}
