import { apiFetch } from './client';

// Authenticated buyer-only discount code lookup. Mirrors
// backend/src/services/discount.service.ts#validateDiscountCode and
// backend/src/routes/discount.routes.ts.

export type DiscountKind = 'VOUCHER' | 'PROMO';
export type DiscountValueType = 'PERCENT' | 'FIXED';

export interface DiscountValidation {
  kind: DiscountKind;
  code: string;
  discountType: DiscountValueType;
  discountValue: number;
  amount: number;
}

/**
 * Validates a voucher/promo code against the given subtotal. Throws
 * `ApiClientError` with code `DISCOUNT_NOT_FOUND` (404), `DISCOUNT_EXPIRED`
 * (409), or `DISCOUNT_EXHAUSTED` (409) — callers show `err.message` inline.
 */
export function validateDiscountCode(code: string, subtotal: number): Promise<DiscountValidation> {
  return apiFetch<DiscountValidation>('/discounts/validate', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  });
}
