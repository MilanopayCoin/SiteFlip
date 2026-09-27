/**
 * Server-side marketplace commission.
 * Never trust client-supplied fee amounts.
 */

export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.1; // 10%
export const DEFAULT_PAYMENT_FEE_RATE = 0.029; // approximate processor fee display
export const DEFAULT_PAYMENT_FEE_FIXED = 0.25;

export type CommissionSnapshot = {
  salePrice: number;
  platformFee: number;
  paymentFee: number;
  sellerAmount: number;
  currency: string;
  commissionRate: number;
};

export function calculateCommission(
  salePrice: number,
  currency = "EUR",
  commissionRate = DEFAULT_PLATFORM_COMMISSION_RATE
): CommissionSnapshot {
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error("salePrice must be a positive number");
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new Error("commissionRate must be between 0 and 1");
  }

  const platformFee = roundMoney(salePrice * commissionRate);
  const paymentFee = roundMoney(
    salePrice * DEFAULT_PAYMENT_FEE_RATE + DEFAULT_PAYMENT_FEE_FIXED
  );
  const sellerAmount = roundMoney(salePrice - platformFee - paymentFee);

  if (sellerAmount < 0) {
    throw new Error("Fees exceed sale price");
  }

  return {
    salePrice: roundMoney(salePrice),
    platformFee,
    paymentFee,
    sellerAmount,
    currency: currency.toUpperCase(),
    commissionRate,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FundsState =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "HELD_OR_ROUTED"
  | "DELIVERY_PENDING"
  | "DELIVERED"
  | "ACCEPTED"
  | "PAYOUT_PENDING"
  | "PAID_OUT"
  | "REFUNDED"
  | "DISPUTED";

export function fundsStateAfterPaymentPaid(): FundsState {
  return "HELD_OR_ROUTED";
}
