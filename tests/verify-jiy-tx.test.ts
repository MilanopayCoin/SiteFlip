import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jiyToUnits } from "../src/lib/near/jiy-token.ts";

describe("jiy gift policy helpers", () => {
  it("catalog amounts encode to 6-decimal units", () => {
    assert.equal(jiyToUnits(1), "1000000");
    assert.equal(jiyToUnits(5), "5000000");
    assert.equal(jiyToUnits(1000), "1000000000");
  });
});
