"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "Analyze my business.",
  "Should I sell it?",
  "How much should I charge for rent?",
  "Why is my traffic falling?",
  "How can I increase revenue?",
  "Prepare my listing.",
  "Find businesses similar to mine.",
  "Should I rent or sell?",
];

type BizCtx = {
  name: string;
  lifecycle: string;
  monthly_revenue: number | null;
  monthly_profit: number | null;
  monthly_traffic: number | null;
  growth_rate: number | null;
  ai_score: number | null;
  asking_price: number | null;
  is_demo?: boolean;
};

export default function AiCommandCenterPage() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [owned, setOwned] = useState<BizCtx[]>([]);
  const [mode, setMode] = useState("demo");

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        setMode(d.mode ?? "demo");
        setOwned(
          (d.businesses ?? []).map(
            (b: {
              name: string;
              lifecycle: string;
              monthly_revenue: number | null;
              monthly_profit: number | null;
              monthly_traffic: number | null;
              growth_rate: number | null;
              ai_score: number | null;
              asking_price: number | null;
              is_demo?: boolean;
            }) => ({
              name: b.name,
              lifecycle: b.lifecycle,
              monthly_revenue: b.monthly_revenue,
              monthly_profit: b.monthly_profit,
              monthly_traffic: b.monthly_traffic,
              growth_rate: b.growth_rate,
              ai_score: b.ai_score,
              asking_price: b.asking_price,
              is_demo: b.is_demo,
            })
          )
        );
      })
      .catch(() => setOwned([]));
  }, []);

  async function ask(text: string) {
    setLoading(true);
    setPrompt(text);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          context: {
            owned_businesses: owned,
            data_mode: mode,
            note:
              "Use only provided platform fields as stored data. Do not invent metrics. Label assumptions.",
          },
        }),
      });
      const data = await res.json();
      setReply(data.reply ?? data.error);
      setAssumptions(data.assumptions ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">AI Command Center</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Questions use your stored business data
        {mode === "demo" ? " (DEMO / local)" : ""}. Assumptions are labeled.
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        Context businesses: {owned.length || "none yet — create a business first"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
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
            placeholder="Ask about your businesses…"
            rows={3}
          />
          <Button disabled={loading || !prompt.trim()} onClick={() => ask(prompt)}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </CardContent>
      </Card>

      {reply && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-300 whitespace-pre-wrap">
            {reply}
            {assumptions.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
                <p className="font-medium">Assumptions / caveats</p>
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
