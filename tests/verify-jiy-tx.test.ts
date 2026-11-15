import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jiyToUnits,
  normalizeMoveArgAddress,
  normalizeTxHash,
} from "../src/lib/near/jiy-token.ts";

describe("jiy gift policy helpers", () => {
  it("catalog amounts encode to 6-decimal units", () => {
    assert.equal(jiyToUnits(1), "1000000");
    assert.equal(jiyToUnits(5), "5000000");
    assert.equal(jiyToUnits(1000), "1000000000");
  });

  it("normalizes tx hashes to 0x + 64 hex", () => {
    const bare = "ab".repeat(32);
    assert.equal(normalizeTxHash(bare), `0x${bare}`);
    assert.equal(normalizeTxHash(`0x${bare}`), `0x${bare}`);
    assert.throws(() => normalizeTxHash("0xabc"));
  });

  it("pads Move addresses", () => {
    assert.equal(
      normalizeMoveArgAddress("0x1"),
      `0x${"0".repeat(63)}1`
    );
  });
});
