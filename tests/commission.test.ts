import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCommission,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_PAYMENT_FEE_RATE,
  DEFAULT_PAYMENT_FEE_FIXED,
  fundsStateAfterPaymentPaid,
} from "../src/lib/marketplace/commission.ts";

describe("calculateCommission", () => {
  it("splits 10% platform fee and processor fee from sale price", () => {
    const salePrice = 1000;
    const result = calculateCommission(salePrice, "eur");

    const expectedPlatform = Math.round(salePrice * DEFAULT_PLATFORM_COMMISSION_RATE * 100) / 100;
    const expectedPayment =
      Math.round(
        (salePrice * DEFAULT_PAYMENT_FEE_RATE + DEFAULT_PAYMENT_FEE_FIXED) * 100
      ) / 100;
    const expectedSeller =
      Math.round((salePrice - expectedPlatform - expectedPayment) * 100) / 100;

    assert.equal(result.salePrice, 1000);
    assert.equal(result.currency, "EUR");
    assert.equal(result.commissionRate, DEFAULT_PLATFORM_COMMISSION_RATE);
    assert.equal(result.platformFee, expectedPlatform);
    assert.equal(result.paymentFee, expectedPayment);
    assert.equal(result.sellerAmount, expectedSeller);
    assert.equal(result.platformFee, 100);
    assert.equal(result.paymentFee, 29.25);
    assert.equal(result.sellerAmount, 870.75);
  });

  it("accepts a custom commission rate", () => {
    const result = calculateCommission(500, "EUR", 0.05);
    assert.equal(result.platformFee, 25);
    assert.equal(result.commissionRate, 0.05);
    assert.ok(result.sellerAmount < 500);
  });

  it("rejects non-positive sale prices", () => {
    assert.throws(() => calculateCommission(0), /positive/);
    assert.throws(() => calculateCommission(-10), /positive/);
    assert.throws(() => calculateCommission(Number.NaN), /positive/);
  });

  it("rejects invalid commission rates", () => {
    assert.throws(() => calculateCommission(100, "EUR", -0.1), /commissionRate/);
    assert.throws(() => calculateCommission(100, "EUR", 1), /commissionRate/);
  });

  it("rejects fees that exceed sale price", () => {
    // Very high rate leaves little room once payment fee is added
    assert.throws(() => calculateCommission(1, "EUR", 0.99), /Fees exceed/);
  });
});

describe("fundsStateAfterPaymentPaid", () => {
  it("returns HELD_OR_ROUTED", () => {
    assert.equal(fundsStateAfterPaymentPaid(), "HELD_OR_ROUTED");
  });
});
