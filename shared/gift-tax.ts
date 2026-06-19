// Norwegian tax rule: 5 000 NOK per employee per calendar year is gift tax-free.
// Amounts exceeding the aggregate annual limit are taxable as income.
export const ANNUAL_GIFT_LIMIT_NOK = 5_000;

export interface GiftCalculation {
  previousTotal: number;
  giftAmount: number;
  taxFreeThisGift: number;
  taxableThisGift: number;
  totalGiven: number;
  remainingAllowance: number;
}

export function calculateGiftTax(
  previousTotal: number,
  giftAmount: number,
): GiftCalculation {
  const taxFreeAvailable = Math.max(0, ANNUAL_GIFT_LIMIT_NOK - previousTotal);
  const taxFreeThisGift = Math.min(giftAmount, taxFreeAvailable);
  const taxableThisGift = Math.max(0, giftAmount - taxFreeAvailable);
  const totalGiven = previousTotal + giftAmount;
  const remainingAllowance = Math.max(0, ANNUAL_GIFT_LIMIT_NOK - totalGiven);

  return {
    previousTotal,
    giftAmount,
    taxFreeThisGift,
    taxableThisGift,
    totalGiven,
    remainingAllowance,
  };
}
