/**
 * Quote order persistence: Supabase (service role) when configured,
 * otherwise in-process memory for local/demo.
 */

import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  QUOTE_PDF_PRICE_EUR,
  type QuoteDraftInput,
  type QuoteOrder,
  type QuoteStatus,
} from "@/lib/quote/types";

type Row = {
  id: string;
  payload: Omit<
    QuoteOrder,
    "id" | "status" | "molliePaymentId" | "paidAt" | "downloadToken" | "unlockAmount" | "createdAt" | "updatedAt"
  > & {
    createdAt?: string;
    updatedAt?: string;
  };
  status: QuoteStatus;
  mollie_payment_id: string | null;
  download_token: string;
  unlock_amount: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

const g = globalThis as unknown as {
  __jiyQuotes?: Map<string, QuoteOrder>;
};

function mem(): Map<string, QuoteOrder> {
  if (!g.__jiyQuotes) g.__jiyQuotes = new Map();
  return g.__jiyQuotes;
}

function now() {
  return new Date().toISOString();
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

function fromInput(
  input: QuoteDraftInput,
  existing?: QuoteOrder | null
): QuoteOrder {
  const ts = now();
  return {
    id: existing?.id || input.id || nanoid(16),
    createdAt: existing?.createdAt || ts,
    updatedAt: ts,
    issuerName: input.issuerName.trim(),
    issuerEmail: input.issuerEmail.trim().toLowerCase(),
    issuerCompany: emptyToNull(input.issuerCompany),
    issuerAddress: emptyToNull(input.issuerAddress),
    issuerVat: emptyToNull(input.issuerVat),
    clientName: input.clientName.trim(),
    clientEmail: input.clientEmail.trim().toLowerCase(),
    clientCompany: emptyToNull(input.clientCompany),
    clientAddress: emptyToNull(input.clientAddress),
    title: input.title.trim(),
    notes: emptyToNull(input.notes),
    validUntil: emptyToNull(input.validUntil),
    currency: "EUR",
    lineItems: input.lineItems.map((li) => ({
      description: li.description.trim(),
      quantity: li.quantity,
      unitPrice: li.unitPrice,
    })),
    status: existing?.status === "paid" ? "paid" : existing?.status || "draft",
    molliePaymentId: existing?.molliePaymentId ?? null,
    paidAt: existing?.paidAt ?? null,
    downloadToken: existing?.downloadToken || nanoid(24),
    unlockAmount: QUOTE_PDF_PRICE_EUR,
  };
}

function rowToOrder(row: Row): QuoteOrder {
  const p = row.payload || ({} as Row["payload"]);
  return {
    id: row.id,
    createdAt: row.created_at || p.createdAt || now(),
    updatedAt: row.updated_at || p.updatedAt || now(),
    issuerName: p.issuerName,
    issuerEmail: p.issuerEmail,
    issuerCompany: p.issuerCompany ?? null,
    issuerAddress: p.issuerAddress ?? null,
    issuerVat: p.issuerVat ?? null,
    clientName: p.clientName,
    clientEmail: p.clientEmail,
    clientCompany: p.clientCompany ?? null,
    clientAddress: p.clientAddress ?? null,
    title: p.title,
    notes: p.notes ?? null,
    validUntil: p.validUntil ?? null,
    currency: "EUR",
    lineItems: p.lineItems || [],
    status: row.status,
    molliePaymentId: row.mollie_payment_id,
    paidAt: row.paid_at,
    downloadToken: row.download_token,
    unlockAmount: Number(row.unlock_amount) || QUOTE_PDF_PRICE_EUR,
  };
}

function orderPayload(order: QuoteOrder) {
  return {
    issuerName: order.issuerName,
    issuerEmail: order.issuerEmail,
    issuerCompany: order.issuerCompany,
    issuerAddress: order.issuerAddress,
    issuerVat: order.issuerVat,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    clientCompany: order.clientCompany,
    clientAddress: order.clientAddress,
    title: order.title,
    notes: order.notes,
    validUntil: order.validUntil,
    currency: order.currency,
    lineItems: order.lineItems,
  };
}

async function supabase() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function saveQuoteDraft(
  input: QuoteDraftInput
): Promise<QuoteOrder> {
  const db = await supabase();
  let existing: QuoteOrder | null = null;
  if (input.id) {
    existing = await getQuoteById(input.id);
    if (existing?.status === "paid") {
      // Allow metadata edits after pay? No — freeze paid quotes.
      return existing;
    }
  }

  const order = fromInput(input, existing);

  if (db) {
    const { error } = await db.from("quote_orders").upsert(
      {
        id: order.id,
        payload: orderPayload(order),
        status: order.status,
        mollie_payment_id: order.molliePaymentId,
        download_token: order.downloadToken,
        unlock_amount: order.unlockAmount,
        paid_at: order.paidAt,
        updated_at: order.updatedAt,
        created_at: order.createdAt,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`quote_orders upsert failed: ${error.message}`);
    return order;
  }

  mem().set(order.id, order);
  return order;
}

export async function getQuoteById(id: string): Promise<QuoteOrder | null> {
  const db = await supabase();
  if (db) {
    const { data, error } = await db
      .from("quote_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`quote_orders read failed: ${error.message}`);
    if (!data) return null;
    return rowToOrder(data as Row);
  }
  return mem().get(id) ?? null;
}

export async function getQuoteByPaymentId(
  paymentId: string
): Promise<QuoteOrder | null> {
  const db = await supabase();
  if (db) {
    const { data, error } = await db
      .from("quote_orders")
      .select("*")
      .eq("mollie_payment_id", paymentId)
      .maybeSingle();
    if (error) throw new Error(`quote_orders read failed: ${error.message}`);
    if (!data) return null;
    return rowToOrder(data as Row);
  }
  for (const order of mem().values()) {
    if (order.molliePaymentId === paymentId) return order;
  }
  return null;
}

export async function updateQuotePayment(input: {
  id: string;
  status: QuoteStatus;
  molliePaymentId?: string | null;
  paidAt?: string | null;
}): Promise<QuoteOrder | null> {
  const existing = await getQuoteById(input.id);
  if (!existing) return null;

  // Never downgrade from paid
  const status =
    existing.status === "paid" && input.status !== "paid"
      ? "paid"
      : input.status;

  const updated: QuoteOrder = {
    ...existing,
    status,
    molliePaymentId:
      input.molliePaymentId !== undefined
        ? input.molliePaymentId
        : existing.molliePaymentId,
    paidAt:
      status === "paid"
        ? input.paidAt || existing.paidAt || now()
        : existing.paidAt,
    updatedAt: now(),
  };

  const db = await supabase();
  if (db) {
    const { error } = await db
      .from("quote_orders")
      .update({
        status: updated.status,
        mollie_payment_id: updated.molliePaymentId,
        paid_at: updated.paidAt,
        updated_at: updated.updatedAt,
      })
      .eq("id", updated.id);
    if (error) throw new Error(`quote_orders update failed: ${error.message}`);
    return updated;
  }

  mem().set(updated.id, updated);
  return updated;
}

export function verifyDownloadToken(
  order: QuoteOrder,
  token: string | null | undefined
): boolean {
  return Boolean(token && token === order.downloadToken);
}
