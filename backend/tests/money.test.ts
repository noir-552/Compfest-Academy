import { describe, it, expect } from 'vitest';
import {
  DELIVERY_FEES,
  SLA_DAYS,
  computeDiscount,
  computeTotals,
} from '../src/lib/money';

describe('money library', () => {
  describe('DELIVERY_FEES constant', () => {
    it('has correct delivery fees', () => {
      expect(DELIVERY_FEES.INSTANT).toBe(25000);
      expect(DELIVERY_FEES.NEXT_DAY).toBe(15000);
      expect(DELIVERY_FEES.REGULAR).toBe(10000);
    });
  });

  describe('SLA_DAYS constant', () => {
    it('has correct SLA days', () => {
      expect(SLA_DAYS.INSTANT).toBe(1);
      expect(SLA_DAYS.NEXT_DAY).toBe(2);
      expect(SLA_DAYS.REGULAR).toBe(4);
    });
  });

  describe('computeDiscount', () => {
    it('returns zero discount when no voucher or promo', () => {
      const result = computeDiscount(100000);
      expect(result.voucherAmount).toBe(0);
      expect(result.promoAmount).toBe(0);
      expect(result.discountAmount).toBe(0);
    });

    it('applies PERCENT voucher with floor rounding', () => {
      const result = computeDiscount(99999, {
        discountType: 'PERCENT',
        discountValue: 10,
      });
      expect(result.voucherAmount).toBe(9999);
      expect(result.promoAmount).toBe(0);
      expect(result.discountAmount).toBe(9999);
    });

    it('applies FIXED voucher', () => {
      const result = computeDiscount(100000, {
        discountType: 'FIXED',
        discountValue: 20000,
      });
      expect(result.voucherAmount).toBe(20000);
      expect(result.promoAmount).toBe(0);
      expect(result.discountAmount).toBe(20000);
    });

    it('applies voucher first, then promo on remainder', () => {
      const result = computeDiscount(
        80000,
        { discountType: 'FIXED', discountValue: 50000 },
        { discountType: 'PERCENT', discountValue: 50 }
      );
      expect(result.voucherAmount).toBe(50000);
      expect(result.promoAmount).toBe(15000); // floor(0.5 * 30000)
      expect(result.discountAmount).toBe(65000);
    });

    it('caps FIXED voucher at subtotal', () => {
      const result = computeDiscount(50000, {
        discountType: 'FIXED',
        discountValue: 60000,
      });
      expect(result.voucherAmount).toBe(50000);
      expect(result.discountAmount).toBe(50000);
    });

    it('applies PERCENT 100 voucher', () => {
      const result = computeDiscount(100000, {
        discountType: 'PERCENT',
        discountValue: 100,
      });
      expect(result.voucherAmount).toBe(100000);
      expect(result.discountAmount).toBe(100000);
    });

    it('applies FIXED promo without voucher', () => {
      const result = computeDiscount(
        100000,
        undefined,
        { discountType: 'FIXED', discountValue: 20000 }
      );
      expect(result.voucherAmount).toBe(0);
      expect(result.promoAmount).toBe(20000);
      expect(result.discountAmount).toBe(20000);
    });

    it('caps total discount at subtotal', () => {
      const result = computeDiscount(
        50000,
        { discountType: 'FIXED', discountValue: 30000 },
        { discountType: 'FIXED', discountValue: 30000 }
      );
      expect(result.voucherAmount).toBe(30000);
      expect(result.promoAmount).toBe(20000); // remainder is 20000
      expect(result.discountAmount).toBe(50000); // capped at subtotal
    });

    it('handles zero subtotal', () => {
      const result = computeDiscount(0, {
        discountType: 'FIXED',
        discountValue: 100,
      });
      expect(result.voucherAmount).toBe(0);
      expect(result.discountAmount).toBe(0);
    });
  });

  describe('computeTotals', () => {
    it('calculates totals with no discount (basic case)', () => {
      const result = computeTotals(100000, 'REGULAR');
      expect(result.subtotal).toBe(100000);
      expect(result.discountAmount).toBe(0);
      expect(result.deliveryFee).toBe(10000);
      expect(result.ppnAmount).toBe(12000);
      expect(result.finalTotal).toBe(122000);
    });

    it('uses INSTANT delivery fee', () => {
      const result = computeTotals(100000, 'INSTANT');
      expect(result.deliveryFee).toBe(25000);
      expect(result.ppnAmount).toBe(12000);
      expect(result.finalTotal).toBe(137000);
    });

    it('uses NEXT_DAY delivery fee', () => {
      const result = computeTotals(100000, 'NEXT_DAY');
      expect(result.deliveryFee).toBe(15000);
      expect(result.ppnAmount).toBe(12000);
      expect(result.finalTotal).toBe(127000);
    });

    it('calculates with PERCENT voucher', () => {
      const result = computeTotals(99999, 'REGULAR', {
        discountType: 'PERCENT',
        discountValue: 10,
      });
      expect(result.subtotal).toBe(99999);
      expect(result.discountAmount).toBe(9999);
      expect(result.ppnAmount).toBe(Math.floor(0.12 * (99999 - 9999)));
      expect(result.finalTotal).toBe(99999 - 9999 + result.ppnAmount + 10000);
    });

    it('calculates with voucher and promo', () => {
      const result = computeTotals(
        80000,
        'REGULAR',
        { discountType: 'FIXED', discountValue: 50000 },
        { discountType: 'PERCENT', discountValue: 50 }
      );
      expect(result.subtotal).toBe(80000);
      expect(result.discountAmount).toBe(65000);
      expect(result.ppnAmount).toBe(1800);
      expect(result.finalTotal).toBe(80000 - 65000 + 1800 + 10000);
    });

    it('calculates ppnAmount as floor of 0.12 * (subtotal - discount)', () => {
      const result = computeTotals(87654, 'REGULAR', {
        discountType: 'FIXED',
        discountValue: 12345,
      });
      const expectedPpn = Math.floor(0.12 * (87654 - 12345));
      expect(result.ppnAmount).toBe(expectedPpn);
    });

    it('caps discount and sets ppn to 0 when discount exceeds subtotal', () => {
      const result = computeTotals(50000, 'REGULAR', {
        discountType: 'FIXED',
        discountValue: 60000,
      });
      expect(result.discountAmount).toBe(50000);
      expect(result.ppnAmount).toBe(0);
      expect(result.finalTotal).toBe(50000 - 50000 + 0 + 10000);
    });

    it('handles PERCENT 100 voucher (discount = subtotal, ppn = 0)', () => {
      const result = computeTotals(100000, 'REGULAR', {
        discountType: 'PERCENT',
        discountValue: 100,
      });
      expect(result.discountAmount).toBe(100000);
      expect(result.ppnAmount).toBe(0);
      expect(result.finalTotal).toBe(100000 - 100000 + 0 + 10000);
    });

    it('calculates with FIXED promo alone (no voucher)', () => {
      const result = computeTotals(
        100000,
        'REGULAR',
        undefined,
        { discountType: 'FIXED', discountValue: 20000 }
      );
      expect(result.discountAmount).toBe(20000);
      expect(result.ppnAmount).toBe(Math.floor(0.12 * 80000));
      expect(result.finalTotal).toBe(100000 - 20000 + result.ppnAmount + 10000);
    });

    it('handles zero subtotal', () => {
      const result = computeTotals(0, 'REGULAR');
      expect(result.subtotal).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.ppnAmount).toBe(0);
      expect(result.finalTotal).toBe(0 + 0 + 10000);
    });

    it('calculates finalTotal = (subtotal - discount) + ppn + deliveryFee', () => {
      const result = computeTotals(123456, 'NEXT_DAY', {
        discountType: 'PERCENT',
        discountValue: 25,
      });
      const expectedDiscount = Math.floor(0.25 * 123456);
      const expectedPpn = Math.floor(0.12 * (123456 - expectedDiscount));
      const expectedFinal = 123456 - expectedDiscount + expectedPpn + 15000;
      expect(result.discountAmount).toBe(expectedDiscount);
      expect(result.ppnAmount).toBe(expectedPpn);
      expect(result.finalTotal).toBe(expectedFinal);
    });
  });
});
