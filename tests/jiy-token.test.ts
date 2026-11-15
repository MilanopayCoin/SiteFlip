import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatJiy,
  jiyToUnits,
  unitsToJiy,
} from "../src/lib/near/jiy-token.ts";

describe("jiy-token units", () => {
  it("round-trips whole and fractional JIY", () => {
    assert.equal(jiyToUnits(1), "1000000");
    assert.equal(jiyToUnits(1.5), "1500000");
    assert.equal(unitsToJiy("1500000"), 1.5);
    assert.equal(unitsToJiy(jiyToUnits(10)), 10);
  });

  it("formats compact display", () => {
    assert.equal(formatJiy(1.5), "1.5");
    assert.equal(formatJiy(0), "0");
  });
});
