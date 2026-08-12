/**
 * Mollie payment provider — payments only, NOT escrow.
 * Never logs API keys or full payment payloads with secrets.
 */

import type { PaymentIntentResult, TransactionProvider } from "@/lib/transactions/provider";

export type MolliePaymentStatus =
  | "open"
  | "canceled"
  | "pending"
  | "authorized"
  | "expired"
  | "failed"
  | "paid";

export type MolliePayment = {
  id: string;
  status: MolliePaymentStatus | string;
  amount: { value: string; currency: string };
  description?: string;
  metadata?: Record<string, string>;
  checkoutUrl?: string | null;
  _links?: {
    checkout?: { href: string };
    self?: { href: string };
  };
};

function mollieKey(): string | null {
  const key = process.env.MOLLIE_API_KEY?.trim();
  return key || null;
}

export function isMollieConfigured(): boolean {
  return Boolean(mollieKey());
}

export function isMollieTestMode(): boolean {
  const key = mollieKey();
  return Boolean(key?.startsWith("test_"));
}

async function mollieFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const key = mollieKey();
  if (!key) throw new Error("Mollie is not configured");
  return fetch(`https://api.mollie.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function createMolliePayment(input: {
  amount: number;
  currency: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata: Record<string, string>;
}): Promise<MolliePayment> {
  const value = input.amount.toFixed(2);
  const res = await mollieFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: input.currency.toUpperCase(), value },
      description: input.description.slice(0, 255),
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: input.metadata,
    }),
  });

  if (!res.ok) {
    // Do not include response body in thrown message if it might leak details
    throw new Error(`Mollie create payment failed (${res.status})`);
  }

  const payment = (await res.json()) as MolliePayment;
  const checkout =
    payment._links?.checkout?.href || payment.checkoutUrl || null;
  return { ...payment, checkoutUrl: checkout };
}

export async function getMolliePayment(paymentId: string): Promise<MolliePayment> {
  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new Error("Invalid Mollie payment id");
  }
  const res = await mollieFetch(`/payments/${paymentId}`);
  if (!res.ok) {
    throw new Error(`Mollie fetch payment failed (${res.status})`);
  }
  return (await res.json()) as MolliePayment;
}

export function mapMollieStatusToPayment(
  status: string
): "pending" | "paid" | "failed" | "canceled" | "expired" | "open" {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case "open":
    case "pending":
    case "authorized":
    default:
      return status === "open" ? "open" : "pending";
  }
}

/** TransactionProvider adapter for Mollie */
export class MolliePaymentProvider implements TransactionProvider {
  name = "mollie";

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntentResult & { checkoutUrl?: string }> {
    if (!isMollieConfigured()) {
      return {
        provider: "mollie",
        paymentRef: `demo_mollie_${Date.now()}`,
        isEscrow: false,
      };
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.MOLLIE_REDIRECT_BASE ||
      "https://siteflip.miqomilano.workers.dev";
    const webhookUrl =
      process.env.MOLLIE_WEBHOOK_URL ||
      `${appUrl.replace(/\/$/, "")}/api/payments/mollie/webhook`;

    const payment = await createMolliePayment({
      amount: params.amount,
      currency: params.currency,
      description: params.metadata.description || "SITEFLIP transaction",
      redirectUrl:
        params.metadata.redirectUrl ||
        `${appUrl.replace(/\/$/, "")}/dashboard?payment=return`,
      webhookUrl,
      metadata: params.metadata,
    });

    return {
      provider: "mollie",
      paymentRef: payment.id,
      checkoutUrl: payment.checkoutUrl || undefined,
      isEscrow: false,
    };
  }

  async confirmPayment(paymentRef: string) {
    if (!isMollieConfigured()) {
      return { status: "paid" };
    }
    const payment = await getMolliePayment(paymentRef);
    return { status: payment.status };
  }
}
