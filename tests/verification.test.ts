import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  claimLabel,
  isJiyVerified,
  laneState,
  transferReadiness,
} from "../src/lib/marketplace/verification.ts";
import type { BusinessVerification } from "../src/types/database.ts";

function v(
  type: BusinessVerification["type"],
  status: BusinessVerification["status"]
): BusinessVerification {
  return {
    id: `${type}-${status}`,
    business_id: "b1",
    type,
    status,
    provider: "manual",
    evidence: null,
    verified_at: null,
    expires_at: null,
    created_at: new Date().toISOString(),
  };
}

describe("isJiyVerified", () => {
  it("is false with no rows or only pending", () => {
    assert.equal(isJiyVerified([]), false);
    assert.equal(isJiyVerified([v("DOMAIN", "PENDING")]), false);
  });

  it("is true only when at least one VERIFIED", () => {
    assert.equal(isJiyVerified([v("DOMAIN", "VERIFIED")]), true);
    assert.equal(
      isJiyVerified([v("DOMAIN", "FAILED"), v("REVENUE", "VERIFIED")]),
      true
    );
  });
});

describe("laneState", () => {
  it("returns NOT_PROVIDED when empty", () => {
    assert.equal(laneState("REVENUE", []), "NOT_PROVIDED");
  });

  it("prefers VERIFIED over FAILED", () => {
    assert.equal(
      laneState("DOMAIN", [v("DOMAIN", "FAILED"), v("DOMAIN", "VERIFIED")]),
      "VERIFIED"
    );
  });
});

describe("transferReadiness", () => {
  it("READY only when ownership and domain verified", () => {
    assert.equal(transferReadiness([]), "NOT_READY");
    assert.equal(
      transferReadiness([v("OWNERSHIP", "VERIFIED")]),
      "NOT_READY"
    );
    assert.equal(
      transferReadiness([
        v("OWNERSHIP", "VERIFIED"),
        v("DOMAIN", "VERIFIED"),
      ]),
      "READY"
    );
  });
});

describe("claimLabel", () => {
  it("maps boolean to VERIFIED/UNVERIFIED", () => {
    assert.equal(claimLabel(true), "VERIFIED");
    assert.equal(claimLabel(false), "UNVERIFIED");
  });
});
