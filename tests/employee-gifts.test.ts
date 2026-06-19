import { describe, it, expect } from "vitest";
import {
  calculateGiftTax,
  ANNUAL_GIFT_LIMIT_NOK,
} from "../shared/gift-tax";

describe("calculateGiftTax()", () => {
  it("annual limit is 5 000 NOK", () => {
    expect(ANNUAL_GIFT_LIMIT_NOK).toBe(5_000);
  });

  describe("case 1 — first gift of 6 000 NOK exceeds the limit", () => {
    const result = calculateGiftTax(0, 6_000);

    it("tax-free portion is capped at 5 000", () => {
      expect(result.taxFreeThisGift).toBe(5_000);
    });

    it("taxable income is 1 000 (6 000 − 5 000)", () => {
      expect(result.taxableThisGift).toBe(1_000);
    });

    it("total given this year is 6 000", () => {
      expect(result.totalGiven).toBe(6_000);
    });

    it("remaining allowance is 0 — limit exhausted", () => {
      expect(result.remainingAllowance).toBe(0);
    });
  });

  describe("case 2 — first gift of 3 000 NOK stays within the limit", () => {
    const result = calculateGiftTax(0, 3_000);

    it("entire gift is tax-free", () => {
      expect(result.taxFreeThisGift).toBe(3_000);
    });

    it("nothing is taxable", () => {
      expect(result.taxableThisGift).toBe(0);
    });

    it("total given this year is 3 000", () => {
      expect(result.totalGiven).toBe(3_000);
    });

    it("2 000 NOK remains tax-free for the year", () => {
      expect(result.remainingAllowance).toBe(2_000);
    });
  });

  describe("case 3 — second gift: 1 000 previous + 2 000 new", () => {
    const result = calculateGiftTax(1_000, 2_000);

    it("new gift is fully tax-free (4 000 headroom remaining)", () => {
      expect(result.taxFreeThisGift).toBe(2_000);
    });

    it("nothing is taxable", () => {
      expect(result.taxableThisGift).toBe(0);
    });

    it("total given this year is 3 000", () => {
      expect(result.totalGiven).toBe(3_000);
    });

    it("2 000 NOK remains tax-free for the year", () => {
      expect(result.remainingAllowance).toBe(2_000);
    });
  });

  describe("edge cases", () => {
    it("gift of exactly 5 000 with no prior gifts — all tax-free, nothing remaining", () => {
      const r = calculateGiftTax(0, 5_000);
      expect(r.taxFreeThisGift).toBe(5_000);
      expect(r.taxableThisGift).toBe(0);
      expect(r.remainingAllowance).toBe(0);
    });

    it("gift when limit is already fully used — entire amount is taxable", () => {
      const r = calculateGiftTax(5_000, 1_500);
      expect(r.taxFreeThisGift).toBe(0);
      expect(r.taxableThisGift).toBe(1_500);
      expect(r.remainingAllowance).toBe(0);
    });

    it("gift that straddles the limit exactly", () => {
      const r = calculateGiftTax(4_000, 2_000);
      expect(r.taxFreeThisGift).toBe(1_000);
      expect(r.taxableThisGift).toBe(1_000);
      expect(r.remainingAllowance).toBe(0);
    });

    it("previous total already above limit does not produce negative tax-free amount", () => {
      const r = calculateGiftTax(6_000, 500);
      expect(r.taxFreeThisGift).toBe(0);
      expect(r.taxableThisGift).toBe(500);
      expect(r.remainingAllowance).toBe(0);
    });
  });
});
