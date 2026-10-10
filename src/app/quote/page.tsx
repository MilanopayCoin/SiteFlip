"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
};

const emptyLine = (): LineItem => ({
  description: "",
  quantity: "1",
  unitPrice: "",
});

function money(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function QuotePage() {
  const [issuerName, setIssuerName] = useState("");
  const [issuerEmail, setIssuerEmail] = useState("");
  const [issuerCompany, setIssuerCompany] = useState("");
  const [issuerAddress, setIssuerAddress] = useState("");
  const [issuerVat, setIssuerVat] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    return lines.reduce((sum, li) => {
      const q = Number(li.quantity) || 0;
      const p = Number(li.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function payAndDownload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const draftRes = await fetch("/api/quote/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quoteId || undefined,
          issuerName,
          issuerEmail,
          issuerCompany,
          issuerAddress,
          issuerVat,
          clientName,
          clientEmail,
          clientCompany,
          clientAddress,
          title,
          notes,
          validUntil,
          lineItems: lines.map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
          })),
        }),
      });
      const draft = await draftRes.json();
      if (!draftRes.ok) {
        throw new Error(draft.error || "Failed to save draft");
      }

      const id = draft.quote.id as string;
      const token = draft.quote.downloadToken as string;
      setQuoteId(id);
      try {
        localStorage.setItem(`jiy-quote-${id}`, token);
      } catch {
        // ignore
      }

      const checkoutRes = await fetch("/api/quote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: id, downloadToken: token }),
      });
      const checkout = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkout.error || "Checkout failed");
      }

      if (checkout.alreadyPaid) {
        window.location.href = `/quote/success?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
        return;
      }
      if (!checkout.checkoutUrl) {
        throw new Error("No Mollie checkout URL returned");
      }
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="jiy-container max-w-2xl py-8 sm:py-10">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          JIY Quote
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Professional quote PDF — €1
        </h1>
        <p className="max-w-xl text-sm text-muted sm:text-base">
          Fill in the offer, pay €1 with Mollie (test mode), download the PDF.
          No account required. Payment unlocks the file only — not e-sign, not
          escrow.
        </p>
      </header>

      <form onSubmit={payAndDownload} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            From (you)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issuerName">Name *</Label>
              <Input
                id="issuerName"
                required
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                placeholder="Alex Founder"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuerEmail">Email *</Label>
              <Input
                id="issuerEmail"
                type="email"
                required
                value={issuerEmail}
                onChange={(e) => setIssuerEmail(e.target.value)}
                placeholder="you@studio.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuerCompany">Company</Label>
              <Input
                id="issuerCompany"
                value={issuerCompany}
                onChange={(e) => setIssuerCompany(e.target.value)}
                placeholder="Studio BV"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuerVat">VAT</Label>
              <Input
                id="issuerVat"
                value={issuerVat}
                onChange={(e) => setIssuerVat(e.target.value)}
                placeholder="NL000000000B01"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="issuerAddress">Address</Label>
              <Input
                id="issuerAddress"
                value={issuerAddress}
                onChange={(e) => setIssuerAddress(e.target.value)}
                placeholder="Amsterdam, NL"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Bill to (client)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Name *</Label>
              <Input
                id="clientName"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email *</Label>
              <Input
                id="clientEmail"
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientCompany">Company</Label>
              <Input
                id="clientCompany"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valid until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clientAddress">Address</Label>
              <Input
                id="clientAddress"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Quote details
          </h2>
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign — Phase 1"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((p) => [...p, emptyLine()])}
                disabled={lines.length >= 20}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add line
              </Button>
            </div>
            {lines.map((li, i) => (
              <div
                key={i}
                className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[1fr_5rem_7rem_auto]"
              >
                <Input
                  required
                  value={li.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  placeholder="Description"
                />
                <Input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  value={li.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  placeholder="Qty"
                />
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={li.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                  placeholder="€"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length <= 1}
                  onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-right text-sm text-muted">
              Quote subtotal:{" "}
              <span className="font-medium text-foreground">{money(subtotal)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, scope, or delivery notes…"
              rows={3}
            />
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="sticky bottom-16 z-10 space-y-2 border-t border-border bg-background/95 py-4 backdrop-blur md:bottom-0">
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            {loading ? "Redirecting to Mollie…" : "Pay €1 & get PDF"}
          </Button>
          <p className="text-xs text-muted">
            Fixed €1 unlock fee via Mollie. Quote totals above are for the PDF
            content only. Test mode when using a Mollie test_ key.
          </p>
        </div>
      </form>
    </div>
  );
}
