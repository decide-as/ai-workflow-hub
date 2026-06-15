import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("smoke", () => {
  it("should pass a basic assertion", () => {
    assert.strictEqual(1 + 1, 2);
  });
});
