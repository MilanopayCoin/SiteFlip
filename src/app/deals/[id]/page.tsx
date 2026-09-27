"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type Deal = {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  funds_state?: string | null;
  buyer_id: string;
  seller_id: string;
  platform_fee?: number | null;
  payment_fee?: number | null;
  seller_amount?: number | null;
  commission_rate?: number | null;
  payment_provider?: string | null;
  payment_ref?: string | null;
  delivery_submitted_at?: string | null;
  buyer_accepted_at?: string | null;
  terms_snapshot?: Record<string, unknown> | null;
  listing?: { title?: string; id?: string } | null;
  business?: { name?: string } | null;
  notes?: string | null;
};

type Event = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  actor_id: string | null;
};

type Payment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  provider: string;
  provider_ref?: string | null;
  checkout_url?: string | null;
  created_at: string;
};

export default function DealRoomPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(`/api/deals/${id}`);
      const data = await res.json();
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        setError(data.error || "Unauthorized");
        setDeal(null);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to load deal");
      setDeal(data.deal);
      setEvents(data.events ?? []);
      setPayments(data.payments ?? []);
      setRole(data.role ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function callAction(
    path: string,
    body: Record<string, unknown> = {}
  ) {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setStatusMsg("Updated.");
      setActionNote("");
      setDisputeReason("");
      await load();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function startPayment() {
    if (!deal) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/payments/mollie/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: deal.id,
          amount: deal.amount,
          currency: deal.currency,
          type: deal.type === "REVIVE_ACQUISITION" ? "REVIVE_ACQUISITION" : "BUY",
          redirectUrl: undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setStatusMsg("Payment created. Refreshing…");
      await load();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    );
  }

  if (forbidden || (!deal && error)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Deal Room</h1>
        <p className="mt-4 text-sm text-zinc-500">
          {error || "You are not authorized to view this deal."}
        </p>
        <Link
          href="/deals"
          className="mt-6 inline-block text-sm text-zinc-700 underline"
        >
          Back to deals
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-zinc-500">Deal not found.</p>
      </div>
    );
  }

  const title =
    deal.listing?.title || deal.business?.name || `Deal ${deal.id.slice(0, 8)}`;
  const isBuyer = role === "buyer";
  const isSeller = role === "seller";
  const canDeliver =
    isSeller &&
    ["PAYMENT_RECEIVED", "TRANSFER_PENDING", "INSPECTION"].includes(
      deal.status
    ) &&
    deal.funds_state !== "DELIVERED" &&
    deal.funds_state !== "ACCEPTED";
  const canAccept = isBuyer && deal.funds_state === "DELIVERED";
  const canDispute =
    (isBuyer || isSeller) &&
    !["COMPLETED", "CANCELLED"].includes(deal.status) &&
    deal.funds_state !== "DISPUTED";
  const canPay =
    isBuyer &&
    ["INITIATED", "PAYMENT_PENDING", "ACCEPTED", "OFFERED"].includes(
      deal.status
    );

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <div>
        <Link href="/deals" className="text-xs text-zinc-500 hover:text-zinc-700">
          ← Deals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {deal.type} · {deal.status}
          {deal.funds_state ? ` · funds ${deal.funds_state}` : ""} · you are{" "}
          {role || "party"}
        </p>
      </div>

      {/* Overview */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Overview
        </h2>
        <dl className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Amount</dt>
            <dd>{formatCurrency(deal.amount, deal.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Seller receives</dt>
            <dd>
              {deal.seller_amount != null
                ? formatCurrency(deal.seller_amount, deal.currency)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Platform fee</dt>
            <dd>
              {deal.platform_fee != null
                ? formatCurrency(deal.platform_fee, deal.currency)
                : "—"}
              {deal.commission_rate != null
                ? ` (${(Number(deal.commission_rate) * 100).toFixed(0)}%)`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Payment fee</dt>
            <dd>
              {deal.payment_fee != null
                ? formatCurrency(deal.payment_fee, deal.currency)
                : "—"}
            </dd>
          </div>
        </dl>
        {deal.notes && (
          <p className="mt-3 text-xs text-zinc-500">{deal.notes}</p>
        )}
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Payment
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          Mollie processes payment only — not escrow. Ownership does not
          transfer on paid alone.
        </p>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-4">
                <span>
                  {p.provider} · {p.status}
                  {p.provider_ref ? ` · ${p.provider_ref}` : ""}
                </span>
                <span>{formatCurrency(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {canPay && (
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => void startPayment()}
          >
            {busy ? "Starting…" : "Pay with Mollie"}
          </Button>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Timeline
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No events yet.</p>
        ) : (
          <ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="text-sm">
                <p className="text-zinc-200">
                  {ev.from_status ? `${ev.from_status} → ` : ""}
                  {ev.to_status}
                </p>
                {ev.note && (
                  <p className="text-xs text-zinc-500">{ev.note}</p>
                )}
                <p className="text-[10px] text-zinc-600">
                  {new Date(ev.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Actions */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Delivery / Accept / Dispute
        </h2>

        {(canDeliver || canAccept) && (
          <Textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="Optional note"
            className="max-w-md"
          />
        )}

        <div className="flex flex-wrap gap-2">
          {canDeliver && (
            <Button
              disabled={busy}
              onClick={() =>
                void callAction(`/api/deals/${deal.id}/delivery`, {
                  note: actionNote || undefined,
                })
              }
            >
              Submit delivery
            </Button>
          )}
          {canAccept && (
            <Button
              disabled={busy}
              onClick={() =>
                void callAction(`/api/deals/${deal.id}/accept`, {
                  note: actionNote || undefined,
                })
              }
            >
              Accept delivery
            </Button>
          )}
        </div>

        {canDispute && (
          <div className="max-w-md space-y-2">
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Reason for dispute"
            />
            <Button
              variant="outline"
              disabled={busy || disputeReason.trim().length < 3}
              onClick={() =>
                void callAction("/api/disputes", {
                  transactionId: deal.id,
                  reason: disputeReason,
                })
              }
            >
              Open dispute
            </Button>
          </div>
        )}

        {statusMsg && (
          <p className="text-xs text-zinc-500">{statusMsg}</p>
        )}
      </section>
    </div>
  );
}
