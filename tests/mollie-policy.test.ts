import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Mollie payment policy", () => {
  afterEach(() => {
    mock.restoreAll();
    delete process.env.MOLLIE_API_KEY;
    delete process.env.MOLLIE_ALLOW_LIVE;
  });

  it("allows sandbox when key is test_", async () => {
    process.env.MOLLIE_API_KEY = "test_abc";
    const { canCreateMolliePayments, isMollieTestMode } = await import(
      "../src/lib/payments/mollie.ts"
    );
    assert.equal(isMollieTestMode(), true);
    assert.equal(canCreateMolliePayments(), true);
  });

  it("blocks live key until MOLLIE_ALLOW_LIVE is set", async () => {
    process.env.MOLLIE_API_KEY = "live_abc";
    const { canCreateMolliePayments, molliePaymentBlockReason } = await import(
      "../src/lib/payments/mollie.ts"
    );
    assert.equal(canCreateMolliePayments(), false);
    assert.match(
      molliePaymentBlockReason() || "",
      /Live Mollie API key detected/
    );

    process.env.MOLLIE_ALLOW_LIVE = "true";
    const mod = await import("../src/lib/payments/mollie.ts");
    assert.equal(mod.canCreateMolliePayments(), true);
  });
});
