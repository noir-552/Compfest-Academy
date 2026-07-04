/**
 * Money/tax library for graded marketplace.
 * Pure functions, no I/O.
 * All money values in integer rupiah.
 * All rounding uses Math.floor (towards zero for positive numbers).
 */

export const DELIVERY_FEES = { INSTANT: 25000, NEXT_DAY: 15000, REGULAR: 10000 } as const;
export const SLA_DAYS = { INSTANT: 1, NEXT_DAY: 2, REGULAR: 4 } as const;

export type DeliveryMethod = keyof typeof DELIVERY_FEES;

export interface DiscountInput {
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
}

export interface DiscountResult {
  voucherAmount: number;
  promoAmount: number;
  discountAmount: number;
}

export interface TotalsResult {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
}

/**
 * Compute discount amounts from voucher and promo.
 * Applies voucher first on subtotal, then promo on remainder.
 * PERCENT values are floored.
 * Total discount is capped at subtotal (remainder never negative).
 *
 * @param subtotal - subtotal amount in rupiah
 * @param voucher - optional voucher discount
 * @param promo - optional promo discount
 * @returns discount breakdown
 */
export function computeDiscount(
  subtotal: number,
  voucher?: DiscountInput,
  promo?: DiscountInput
): DiscountResult {
  let voucherAmount = 0;
  let promoAmount = 0;

  // Apply voucher first
  if (voucher) {
    if (voucher.discountType === 'PERCENT') {
      voucherAmount = Math.floor((voucher.discountValue / 100) * subtotal);
    } else {
      voucherAmount = voucher.discountValue;
    }
    // Cap voucher at subtotal
    voucherAmount = Math.min(voucherAmount, subtotal);
  }

  // Apply promo on remainder
  if (promo) {
    const remainder = subtotal - voucherAmount;
    if (promo.discountType === 'PERCENT') {
      promoAmount = Math.floor((promo.discountValue / 100) * remainder);
    } else {
      promoAmount = promo.discountValue;
    }
    // Cap promo at remainder
    promoAmount = Math.min(promoAmount, remainder);
  }

  const discountAmount = Math.min(voucherAmount + promoAmount, subtotal);

  return {
    voucherAmount,
    promoAmount,
    discountAmount,
  };
}

/**
 * Compute final totals including discount, tax, and delivery.
 * ppnAmount = Math.floor(0.12 * (subtotal - discountAmount))
 * finalTotal = (subtotal - discountAmount) + ppnAmount + deliveryFee
 *
 * @param subtotal - subtotal amount in rupiah
 * @param method - delivery method
 * @param voucher - optional voucher discount
 * @param promo - optional promo discount
 * @returns totals breakdown
 */
export function computeTotals(
  subtotal: number,
  method: DeliveryMethod,
  voucher?: DiscountInput,
  promo?: DiscountInput
): TotalsResult {
  const discount = computeDiscount(subtotal, voucher, promo);
  const discountAmount = discount.discountAmount;
  const deliveryFee = DELIVERY_FEES[method];

  const taxableAmount = subtotal - discountAmount;
  const ppnAmount = Math.floor(0.12 * taxableAmount);

  const finalTotal = taxableAmount + ppnAmount + deliveryFee;

  return {
    subtotal,
    discountAmount,
    deliveryFee,
    ppnAmount,
    finalTotal,
  };
}
