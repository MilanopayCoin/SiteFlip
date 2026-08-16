/**
 * TransactionProvider architecture
 *
 * Ordinary Mollie payments are NOT escrow.
 * Regulated third-party escrow can be plugged in via escrow_provider.
 */

import type { TransactionStatus, TransactionType } from "@/types/database";

export interface PaymentIntentResult {
  provider: string;
  paymentRef: string;
  clientSecret?: string;
  checkoutUrl?: string;
  /** Always false for standard Mollie Checkout payments */
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

/** Placeholder for future regulated escrow integration */
export class PlaceholderEscrowProvider implements EscrowProvider {
  name = "placeholder_escrow";

  async createEscrow(): Promise<EscrowIntentResult> {
    throw new Error(
      "No regulated escrow provider configured. Do not treat Mollie payments as escrow."
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

/** SITEFLIP uses Mollie as the active payment provider */
export async function getActivePaymentProvider(): Promise<TransactionProvider> {
  const { MolliePaymentProvider } = await import("@/lib/payments/mollie");
  return new MolliePaymentProvider();
}
