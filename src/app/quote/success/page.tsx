"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type StatusPayload = {
  quote?: {
    id: string;
    title: string;
    status: string;
    subtotal?: number;
  };
  downloadReady?: boolean;
  verifiedFromMollie?: string | null;
  error?: string;
};

function SuccessContent() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const tokenParam = params.get("token");
  const [token, setToken] = useState(tokenParam || "");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (!tokenParam) {
      try {
        const stored = localStorage.getItem(`jiy-quote-${id}`);
        if (stored) setToken(stored);
      } catch {
        // ignore
      }
    }
  }, [id, tokenParam]);

  async function refresh() {
    if (!id || !token) {
      setError("Missing quote id or download token.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quote/${encodeURIComponent(id)}/status?token=${encodeURIComponent(token)}&sync=1`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as StatusPayload;
      if (!res.ok) {
        throw new Error(data.error || "Unable to verify payment");
      }
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status check failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id && token) {
      void refresh();
    } else if (id && !token) {
      setLoading(false);
      setError("Missing download token. Open this page from your Mollie redirect or the original browser.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when id/token ready
  }, [id, token]);

  const ready = Boolean(payload?.downloadReady);
  const pdfUrl =
    id && token
      ? `/api/quote/${encodeURIComponent(id)}/pdf?token=${encodeURIComponent(token)}`
      : null;

  return (
    <div className="jiy-container max-w-lg py-10 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        JIY Quote
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {ready ? "Payment confirmed" : "Checking payment…"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Status is verified with Mollie on the server. Browser redirect alone is
        never trusted. Unlock = PDF download only.
      </p>

      <div className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying with Mollie…
          </p>
        )}
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
        {payload?.quote && (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Quote</dt>
              <dd className="text-right font-medium">{payload.quote.title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium">{payload.quote.status}</dd>
            </div>
            {payload.verifiedFromMollie && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Mollie</dt>
                <dd>{payload.verifiedFromMollie}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {ready && pdfUrl ? (
            <Button asChild>
              <a href={pdfUrl}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh status
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/quote">New quote</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function QuoteSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="jiy-container py-10 text-muted">Loading…</div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
