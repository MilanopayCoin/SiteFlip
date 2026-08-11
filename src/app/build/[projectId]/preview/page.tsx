"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface PreviewPayload {
  previewReady: boolean;
  url: string;
  buildStatus: string;
  quality: { overall: number } | null;
  securityStatus: string;
  landing: {
    brandName?: string;
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
    };
    hero: { headline: string; subheadline: string; cta: string };
    features: Array<{ title: string; body: string }>;
    pricingCopy: string;
    faq: Array<{ q: string; a: string }>;
    completeness: string;
  } | null;
  limitations: string[];
  tests: { passed?: boolean; checks?: Array<{ name: string; status: string }> } | null;
}

export default function FactoryPreviewPage() {
  const params = useParams<{ projectId: string }>();
  const [data, setData] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    fetch(`/api/factory/projects/${params.projectId}/preview`)
      .then((r) => r.json())
      .then(setData);
  }, [params.projectId]);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading preview…
      </div>
    );
  }

  const landing = data.landing;
  const bg = landing?.colors?.background ?? "#07070c";
  const primary = landing?.colors?.primary ?? "#8b5cf6";

  return (
    <div>
      <div className="border-b border-white/5 bg-black/40 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.previewReady ? "success" : "warning"}>
              {data.previewReady ? "Preview Ready" : "Preview incomplete"}
            </Badge>
            <Badge variant="outline">{data.buildStatus}</Badge>
            <span className="text-xs text-zinc-500">{data.securityStatus}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/build/${params.projectId}`}>Request changes</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/build/${params.projectId}`}>Approve deployment</Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-7xl text-xs text-zinc-500">
          Completeness: {landing?.completeness ?? "—"} · AI Score{" "}
          {data.quality?.overall ?? "—"}/100 ·{" "}
          {data.limitations.join(" · ")}
        </div>
      </div>

      {landing ? (
        <main style={{ background: bg, minHeight: "70vh" }}>
          <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <p
              className="text-xs font-medium uppercase tracking-[0.2em]"
              style={{ color: primary }}
            >
              {landing.brandName}
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
              {landing.hero.headline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              {landing.hero.subheadline}
            </p>
            <button
              className="mt-8 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: primary }}
            >
              {landing.hero.cta}
            </button>
          </section>

          <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
            {landing.features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h3 className="font-medium text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
              </div>
            ))}
          </section>

          <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
            <h2 className="text-2xl font-semibold text-white">Pricing</h2>
            <p className="mt-2 text-zinc-400">{landing.pricingCopy}</p>
          </section>

          <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
            <h2 className="text-2xl font-semibold text-white">FAQ</h2>
            <div className="mt-4 space-y-3">
              {landing.faq.map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <summary className="cursor-pointer text-white">{item.q}</summary>
                  <p className="mt-2 text-sm text-zinc-400">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <Card className="mx-auto mt-10 max-w-lg">
          <CardContent className="p-6 text-sm text-zinc-400">
            Preview not ready. Run the factory pipeline first.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
