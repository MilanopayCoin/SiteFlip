"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { BusinessBlueprint } from "@/types/database";

const STEPS = [
  { key: "goal", label: "What do you want to build?", type: "textarea" as const, placeholder: "I want an online business that can make €2,000/month." },
  { key: "budget", label: "Budget", type: "select" as const, options: ["Under €500", "€500–€2,000", "€2,000–€10,000", "€10,000+"] },
  { key: "businessType", label: "Business type", type: "select" as const, options: ["SaaS", "AI Tool", "Ecommerce", "Newsletter", "Affiliate", "Digital Product", "Chrome Extension", "Agency"] },
  { key: "targetAudience", label: "Target audience", type: "text" as const, placeholder: "e.g. EU freelancers" },
  { key: "country", label: "Country / market", type: "text" as const, placeholder: "e.g. Germany, EU, Global" },
  { key: "revenueGoal", label: "Revenue goal", type: "select" as const, options: ["€500/mo", "€2,000/mo", "€5,000/mo", "€10,000+/mo"] },
  { key: "availableTime", label: "Available time", type: "select" as const, options: ["5 hrs/week", "10 hrs/week", "20 hrs/week", "Full-time"] },
];

export default function BuildPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({
    goal: "",
    budget: "€500–€2,000",
    businessType: "SaaS",
    targetAudience: "",
    country: "EU",
    revenueGoal: "€2,000/mo",
    availableTime: "10 hrs/week",
  });
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<BusinessBlueprint | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [source, setSource] = useState<string>("");
  const [started, setStarted] = useState(false);

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBlueprint(data.blueprint);
      setAssumptions(data.assumptions ?? []);
      setSource(data.source ?? "heuristic");
    } catch {
      setAssumptions(["Generation failed — try again"]);
    } finally {
      setLoading(false);
    }
  }

  if (blueprint) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Badge variant="info" className="mb-4 gap-1">
          <Sparkles className="h-3 w-3" /> Business Blueprint · {source}
        </Badge>
        <h1 className="text-3xl font-semibold text-white">{blueprint.name}</h1>
        <p className="mt-2 text-zinc-400">{blueprint.businessModel}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Info title="Target audience" body={blueprint.targetAudience} />
          <Info title="Pricing" body={blueprint.pricing} />
          <Info title="Problem" body={blueprint.problem} />
          <Info title="Solution" body={blueprint.solution} />
          <Info title="Revenue projection" body={blueprint.revenueProjection} />
          <Info title="Landing CTA" body={blueprint.landingPage.cta} />
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Landing page structure</CardTitle></CardHeader>
          <CardContent>
            <p className="text-violet-300">{blueprint.landingPage.hero}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
              {blueprint.landingPage.sections.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ListCard title="Marketing plan" items={blueprint.marketingPlan} />
          <ListCard title="Growth strategy" items={blueprint.growthStrategy} />
          <ListCard title="Technology stack" items={blueprint.technologyStack} />
          <ListCard title="Domain ideas" items={blueprint.domainIdeas} />
          <ListCard title="SEO strategy" items={blueprint.seoStrategy} />
        </div>

        <Card className="mt-6 border-amber-500/20">
          <CardContent className="p-5 text-sm text-amber-200/80">
            <p className="font-medium text-amber-300">AI assumptions (labeled)</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              START BUILDING generates starter assets (landing structure, brand concept,
              copy outlines). It does not produce a complete production SaaS.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            onClick={() => setStarted(true)}
            disabled={started}
          >
            {started ? "Build started (demo)" : "Start Building"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setBlueprint(null);
              setStep(0);
            }}
          >
            New blueprint
          </Button>
        </div>
        {started && (
          <p className="mt-4 text-sm text-zinc-400">
            Architecture ready for external AI coding/building services. Lifecycle set to
            BUILDING in demo mode.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
        AI Business Factory
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
        Build your next business with AI.
      </h1>
      <p className="mt-2 text-zinc-400">
        Multi-step wizard → business blueprint. Starter assets only — not a fake full SaaS.
      </p>

      <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-400"
          animate={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Step {step + 1} of {STEPS.length}
      </p>

      <Card className="mt-6">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <Label className="text-base text-white">{current.label}</Label>
              {current.type === "textarea" && (
                <Textarea
                  className="mt-3"
                  rows={4}
                  placeholder={current.placeholder}
                  value={form[current.key] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [current.key]: e.target.value }))
                  }
                />
              )}
              {current.type === "text" && (
                <Input
                  className="mt-3"
                  placeholder={current.placeholder}
                  value={form[current.key] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [current.key]: e.target.value }))
                  }
                />
              )}
              {current.type === "select" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.options!.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, [current.key]: opt }))}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        form[current.key] === opt
                          ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                          : "border-white/10 text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-between">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!form[current.key]}
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={generate} disabled={loading || !form.goal}>
                {loading ? "Generating…" : "Generate Blueprint"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase text-zinc-500">{title}</p>
      <p className="mt-1 text-sm text-zinc-200">{body}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
