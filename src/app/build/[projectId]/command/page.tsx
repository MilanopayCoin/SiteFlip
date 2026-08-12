"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "Analyze my business.",
  "Why are visitors falling?",
  "Create a new pricing plan.",
  "Improve my landing page.",
  "Add a referral system.",
  "Create a blog.",
  "Add Mollie.",
  "Build an admin dashboard.",
  "Prepare this business for sale.",
];

export default function FactoryCommandPage() {
  const params = useParams<{ projectId: string }>();
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [inspected, setInspected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(text: string) {
    setLoading(true);
    setPrompt(text);
    const res = await fetch(`/api/factory/projects/${params.projectId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    const data = await res.json();
    setReply(data.reply ?? data.error);
    setAssumptions(data.assumptions ?? []);
    setInspected(data.inspectedState ?? null);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/build/${params.projectId}`}>← Back to project</Link>
      </Button>
      <h1 className="mt-4 text-2xl font-semibold text-white">
        AI Command Center
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Inspects current factory state first. Never pretends a feature exists unless
        it is in outputs.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
          >
            {s}
          </button>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-3 p-5">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Ask about this generated business…"
          />
          <Button disabled={loading || !prompt} onClick={() => ask(prompt)}>
            {loading ? "Inspecting…" : "Ask"}
          </Button>
        </CardContent>
      </Card>

      {inspected && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Inspected state</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto text-xs text-zinc-400">
              {JSON.stringify(inspected, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {reply && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{reply}</p>
            {assumptions.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100/80">
                <p className="font-medium text-amber-300">AI assumptions</p>
                <ul className="mt-1 list-disc pl-4">
                  {assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
