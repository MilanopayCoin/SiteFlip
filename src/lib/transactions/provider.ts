/**
 * TransactionProvider architecture
 *
 * Ordinary Stripe (or similar) payments are NOT escrow.
 * Regulated third-party escrow can be plugged in via escrow_provider.
 */

import type { TransactionStatus, TransactionType } from "@/types/database";

export interface PaymentIntentResult {
  provider: string;
  paymentRef: string;
  clientSecret?: string;
  /** Always false for standard Stripe Checkout / PaymentIntents */
  isEscrow: false;
}

export interface EscrowIntentResult {
  escrowProvider: string;
  escrowRef: string;
  isEscrow: true;
  statusUrl?: string;
}

export interface TransactionProvider {
  name: string;
  createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntentResult>;
  confirmPayment(paymentRef: string): Promise<{ status: string }>;
}

export interface EscrowProvider {
  name: string;
  createEscrow(params: {
    amount: number;
    currency: string;
    buyerId: string;
    sellerId: string;
    metadata: Record<string, string>;
  }): Promise<EscrowIntentResult>;
  releaseEscrow(escrowRef: string): Promise<{ status: string }>;
  refundEscrow(escrowRef: string): Promise<{ status: string }>;
}

export const TRANSACTION_STATUS_FLOW: Record<
  TransactionStatus,
  TransactionStatus[]
> = {
  INITIATED: ["OFFERED", "PAYMENT_PENDING", "CANCELLED"],
  OFFERED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAYMENT_RECEIVED", "CANCELLED", "DISPUTED"],
  PAYMENT_RECEIVED: ["TRANSFER_PENDING", "INSPECTION", "DISPUTED"],
  TRANSFER_PENDING: ["INSPECTION", "COMPLETED", "DISPUTED"],
  INSPECTION: ["COMPLETED", "DISPUTED", "CANCELLED"],
  COMPLETED: [],
  DISPUTED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(
  from: TransactionStatus,
  to: TransactionStatus
): boolean {
  return TRANSACTION_STATUS_FLOW[from]?.includes(to) ?? false;
}

/** Stripe provider stub — payments only, NOT escrow */
export class StripePaymentProvider implements TransactionProvider {
  name = "stripe";

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        provider: "stripe",
        paymentRef: `demo_pi_${Date.now()}`,
        isEscrow: false,
      };
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
    });

    return {
      provider: "stripe",
      paymentRef: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      isEscrow: false,
    };
  }

  async confirmPayment(paymentRef: string) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { status: "succeeded" };
    }
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(paymentRef);
    return { status: intent.status };
  }
}

/** Placeholder for future regulated escrow integration */
export class PlaceholderEscrowProvider implements EscrowProvider {
  name = "placeholder_escrow";

  async createEscrow(): Promise<EscrowIntentResult> {
    throw new Error(
      "No regulated escrow provider configured. Do not treat Stripe payments as escrow."
    );
  }

  async releaseEscrow(): Promise<{ status: string }> {
    throw new Error("No regulated escrow provider configured.");
  }

  async refundEscrow(): Promise<{ status: string }> {
    throw new Error("No regulated escrow provider configured.");
  }
}

export function getTransactionLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    BUY: "Purchase",
    RENT: "Rental",
    RENT_TO_OWN: "Rent to Own",
    SELL: "Sale",
    REVIVE_ACQUISITION: "Revive Acquisition",
  };
  return labels[type];
}
