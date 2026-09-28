"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import { DealLifecycleTimeline } from "@/components/deals/deal-lifecycle-timeline";

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

const TABS = [
  "Overview",
  "Payment",
  "Delivery",
  "Timeline",
  "Dispute",
] as const;

type Tab = (typeof TABS)[number];

type MollieConfig = {
  configured: boolean;
  testMode: boolean | null;
  liveMode: boolean | null;
  liveBlocked: boolean;
  paymentsEnabled: boolean;
};

export default function DealRoomPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [mollieConfig, setMollieConfig] = useState<MollieConfig | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/mollie/create")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMollieConfig({
          configured: Boolean(data.configured),
          testMode: data.testMode ?? null,
          liveMode: data.liveMode ?? null,
          liveBlocked: Boolean(data.liveBlocked),
          paymentsEnabled: Boolean(data.paymentsEnabled),
        });
      })
      .catch(() => {
        if (!cancelled) setMollieConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (mollieConfig && !mollieConfig.paymentsEnabled) {
      setStatusMsg(
        "Checkout is disabled: live Mollie key without MOLLIE_ALLOW_LIVE. Use a test_ key for sandbox."
      );
      return;
    }
    if (
      mollieConfig?.liveMode &&
      !mollieConfig.testMode &&
      typeof window !== "undefined" &&
      !window.confirm(
        "This environment uses a live Mollie key. You may be charged real money. Continue?"
      )
    ) {
      return;
    }
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
          type:
            deal.type === "REVIVE_ACQUISITION" ? "REVIVE_ACQUISITION" : "BUY",
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
      <div className="jiy-container max-w-3xl py-10">
        <div className="h-48 animate-pulse rounded-[12px] bg-surface-2" />
      </div>
    );
  }

  if (forbidden || (!deal && error)) {
    return (
      <div className="jiy-container max-w-3xl py-10">
        <p className="sf-label">Deal room</p>
        <h1 className="font-display mt-1 text-2xl text-foreground">Access denied</h1>
        <p className="mt-3 text-sm text-muted">
          {error || "You are not authorized to view this deal."}
        </p>
        <Link href="/deals" className="mt-6 inline-block text-sm underline">
          Back to deals
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="jiy-container max-w-3xl py-10">
        <p className="text-sm text-muted">Deal not found.</p>
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
    <div className="jiy-container max-w-3xl py-8 sm:py-10">
      <Link href="/deals" className="text-xs text-muted hover:text-foreground">
        ← Deals
      </Link>

      <div className="mt-3 border-b border-border pb-6">
        <p className="sf-label">Deal room</p>
        <h1 className="font-display mt-1 text-3xl text-foreground">{title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>{deal.type}</Chip>
          <Chip>{deal.status}</Chip>
          {deal.funds_state && <Chip>Funds {deal.funds_state}</Chip>}
          <Chip>You · {role || "party"}</Chip>
          <Chip mono>{deal.id.slice(0, 8)}</Chip>
        </div>
        <p className="mt-4 font-mono text-2xl tabular font-semibold text-foreground">
          {formatCurrency(deal.amount, deal.currency)}
        </p>
        <div className="mt-6 rounded-[12px] border border-border bg-surface p-4">
          <DealLifecycleTimeline
            status={deal.status}
            fundsState={deal.funds_state}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "jiy-focus-ring shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "Overview" && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Metric
              label="Seller receives"
              value={
                deal.seller_amount != null
                  ? formatCurrency(deal.seller_amount, deal.currency)
                  : "—"
              }
            />
            <Metric
              label="Platform fee"
              value={
                deal.platform_fee != null
                  ? `${formatCurrency(deal.platform_fee, deal.currency)}${
                      deal.commission_rate != null
                        ? ` · ${(Number(deal.commission_rate) * 100).toFixed(0)}%`
                        : ""
                    }`
                  : "—"
              }
            />
            <Metric
              label="Payment fee"
              value={
                deal.payment_fee != null
                  ? formatCurrency(deal.payment_fee, deal.currency)
                  : "—"
              }
            />
            <Metric
              label="Listing"
              value={
                deal.listing?.id ? (
                  <Link
                    href={`/listings/${deal.listing.id}`}
                    className="underline"
                  >
                    View listing
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            {deal.notes && (
              <div className="sm:col-span-2">
                <p className="sf-label">Notes</p>
                <p className="mt-1 text-sm text-muted">{deal.notes}</p>
              </div>
            )}
          </dl>
        )}

        {tab === "Payment" && (
          <div className="space-y-4">
            {mollieConfig?.configured && (
              <div
                className={cn(
                  "border px-3 py-2 text-sm",
                  mollieConfig.liveBlocked
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : mollieConfig.testMode
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800"
                )}
              >
                {mollieConfig.liveBlocked ? (
                  <>
                    <strong>Live key blocked.</strong> Swap to a{" "}
                    <code className="text-xs">test_</code> API key for sandbox
                    checkout, or set{" "}
                    <code className="text-xs">MOLLIE_ALLOW_LIVE=true</code> on
                    the Worker.
                  </>
                ) : mollieConfig.testMode ? (
                  <>
                    <strong>Sandbox mode.</strong> Mollie test key — no real
                    charges.
                  </>
                ) : (
                  <>
                    <strong>Live Mollie.</strong> Checkout may charge real
                    money. Confirm before paying.
                  </>
                )}
              </div>
            )}
            <p className="text-sm text-muted">
              Mollie processes payment only — not escrow. Paid status is set only
              after provider webhook confirmation.
            </p>
            {payments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <ul className="sf-panel divide-y divide-border">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {p.provider} · {p.status}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {p.provider_ref || p.id.slice(0, 8)} ·{" "}
                        {new Date(p.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="tabular font-medium">
                      {formatCurrency(p.amount, p.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canPay && (
              <Button
                disabled={
                  busy ||
                  (mollieConfig !== null && !mollieConfig.paymentsEnabled)
                }
                onClick={() => void startPayment()}
              >
                {busy
                  ? "Starting…"
                  : mollieConfig?.liveBlocked
                    ? "Pay blocked (live key)"
                    : "Pay with Mollie"}
              </Button>
            )}
          </div>
        )}

        {tab === "Delivery" && (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Metric
                label="Delivery submitted"
                value={
                  deal.delivery_submitted_at
                    ? new Date(deal.delivery_submitted_at).toLocaleString()
                    : "Not yet"
                }
              />
              <Metric
                label="Buyer accepted"
                value={
                  deal.buyer_accepted_at
                    ? new Date(deal.buyer_accepted_at).toLocaleString()
                    : "Not yet"
                }
              />
            </dl>
            {(canDeliver || canAccept) && (
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Optional note"
                className="rounded-md"
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
              {!canDeliver && !canAccept && (
                <p className="text-sm text-muted">
                  No delivery actions available in the current state.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "Timeline" && (
          <div>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No events yet.</p>
            ) : (
              <ol className="space-y-0 border-l border-border">
                {events.map((ev) => (
                  <li key={ev.id} className="relative py-4 pl-6">
                    <span className="absolute top-5 -left-[5px] h-2.5 w-2.5 rounded-full border border-border bg-background" />
                    <p className="text-sm font-medium text-foreground">
                      {ev.from_status ? `${ev.from_status} → ` : ""}
                      {ev.to_status}
                    </p>
                    {ev.note && (
                      <p className="mt-1 text-sm text-muted">{ev.note}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted">
                      {new Date(ev.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {tab === "Dispute" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Opening a dispute blocks payout until an admin resolves it.
            </p>
            {canDispute ? (
              <>
                <Textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Reason for dispute (required)"
                  className="rounded-md"
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
              </>
            ) : (
              <p className="text-sm text-muted">
                Dispute is not available for this deal state.
              </p>
            )}
          </div>
        )}
      </div>

      {statusMsg && (
        <p className="mt-8 rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-muted">
          {statusMsg}
        </p>
      )}
    </div>
  );
}

function Chip({
  children,
  mono,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border border-border bg-surface px-2 py-0.5 text-muted",
        mono && "font-mono"
      )}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="sf-panel px-4 py-3">
      <p className="sf-label">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
