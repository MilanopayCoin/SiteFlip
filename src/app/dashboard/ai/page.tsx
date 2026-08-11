"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_BUSINESSES } from "@/lib/data/demo";

const SUGGESTIONS = [
  "Analyze my business.",
  "Should I sell it?",
  "How much should I charge for rent?",
  "Why is my traffic falling?",
  "How can I increase revenue?",
  "Prepare my listing.",
  "Find businesses similar to mine.",
  "Find a business I can buy for €5,000.",
];

export default function AiCommandCenterPage() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const context = {
    owned_businesses: DEMO_BUSINESSES.filter((b) => b.current_owner_id === "seller-1").map(
      (b) => ({
        name: b.name,
        lifecycle: b.lifecycle,
        monthly_revenue: b.monthly_revenue,
        monthly_profit: b.monthly_profit,
        monthly_traffic: b.monthly_traffic,
        growth_rate: b.growth_rate,
        ai_score: b.ai_score,
        asking_price: b.asking_price,
      })
    ),
    note: "Demo verified platform fields only — seller claims not auto-verified",
  };

  async function ask(text: string) {
    setLoading(true);
    setPrompt(text);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, context }),
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
        Ask questions using available verified platform data. Assumptions are labeled.
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
            placeholder="Ask SITEFLIP AI…"
            rows={3}
          />
          <Button disabled={loading || !prompt} onClick={() => ask(prompt)}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </CardContent>
      </Card>

      {reply && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{reply}</p>
            {assumptions.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200/80">
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
