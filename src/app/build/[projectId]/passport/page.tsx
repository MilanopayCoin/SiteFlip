"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessPassport, FactoryProject } from "@/lib/factory/types";
import {
  cacheFactoryProject,
  readCachedFactoryProject,
} from "@/lib/factory/client-cache";

export default function FactoryPassportPage() {
  const params = useParams<{ projectId: string }>();
  const id = params.projectId;
  const [project, setProject] = useState<FactoryProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cached = readCachedFactoryProject(id);
      if (cached && !cancelled) {
        setProject(cached);
        setError(null);
      }
      let res = await fetch(`/api/factory/projects/${id}`);
      if (!res.ok && cached) {
        res = await fetch(`/api/factory/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: cached }),
        });
      }
      if (cancelled) return;
      if (!res.ok) {
        if (!cached) setError("Not found");
        return;
      }
      const data = await res.json();
      setProject(data.project);
      cacheFactoryProject(data.project);
      setError(null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !project) {
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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">
        Loading passport…
      </div>
    );
  }

  const passport: BusinessPassport | null = project.passport;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/build/${id}`}>← Back to project</Link>
      </Button>
      <p className="mt-4 text-sm uppercase tracking-[0.2em] text-violet-400">
        Business Passport
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-white">
        {passport?.businessName || project.name}
      </h1>
      <p className="mt-1 font-mono text-sm text-zinc-500">
        ID: {passport?.businessId || project.id}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{passport?.lifecycle || "BUILDING"}</Badge>
        <Badge variant="info">{project.state}</Badge>
        <Badge variant="warning">
          {project.persistenceMode === "SUPABASE"
            ? "PERSISTED"
            : "LOCAL / DEMO / NOT PERSISTED"}
        </Badge>
        {project.quality && (
          <Badge variant="success">AI Score {project.quality.overall}/100</Badge>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <Row label="Owner" value={passport?.owner || project.ownerId} />
            <Row
              label="Created"
              value={new Date(project.createdAt).toLocaleString()}
            />
            <Row label="Factory status" value={project.state} />
            <Row label="Lifecycle" value={passport?.lifecycle || "BUILDING"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <Row
              label="Business model"
              value={passport?.businessModel || project.brief.businessType}
            />
            <Row
              label="Target customer"
              value={passport?.targetCustomer || project.brief.targetCustomer}
            />
            <Row
              label="Revenue model"
              value={passport?.revenueModel || "—"}
            />
            <Row
              label="AI Score"
              value={
                project.quality
                  ? `${project.quality.overall}/100`
                  : "Not scored yet"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Technology</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(passport?.technology?.length
            ? passport.technology
            : project.brief.preferredTechnology?.split(/,\s*/) || ["—"]
          ).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(passport?.timeline?.length
            ? passport.timeline
            : [{ at: project.createdAt, label: "Project created" }]
          ).map((t) => (
            <div key={t.at + t.label} className="border-l border-white/10 pl-3">
              <p className="text-xs text-zinc-500">
                {new Date(t.at).toLocaleString()}
              </p>
              <p className="text-zinc-300">{t.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-amber-200/80">
        {passport?.persistenceNote ||
          "LOCAL / DEMO / NOT PERSISTED — in-memory factory store only."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/build/${id}/sell`}>BUILD → SELL</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/build/${id}/command`}>BUILD → GROW</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/build/${id}/rent`}>BUILD → RENT</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-200">{value}</span>
    </div>
  );
}
