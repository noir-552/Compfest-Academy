import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { now } from '../lib/clock';
import { computeDiscount } from '../lib/money';
import type { DiscountInput } from '../lib/money';

export type DiscountType = 'PERCENT' | 'FIXED';

export interface CreateVoucherInput {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  usageLimit: number;
  expiryDate: Date;
}

export interface CreatePromoInput {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  expiryDate: Date;
}

export interface PublicVoucher {
  id: string;
  createdByAdminId: string;
  code: string;
  discountType: string;
  discountValue: number;
  usageLimit: number;
  usageRemaining: number;
  expiryDate: Date;
  createdAt: Date;
}

export interface PublicPromo {
  id: string;
  createdByAdminId: string;
  code: string;
  discountType: string;
  discountValue: number;
  expiryDate: Date;
  createdAt: Date;
}

export interface ValidateDiscountResult {
  kind: 'VOUCHER' | 'PROMO';
  code: string;
  discountType: string;
  discountValue: number;
  amount: number;
}

interface VoucherRecord {
  id: string;
  createdByAdminId: string;
  code: string;
  discountType: string;
  discountValue: number;
  usageLimit: number;
  usageRemaining: number;
  expiryDate: Date;
  createdAt: Date;
}

interface PromoRecord {
  id: string;
  createdByAdminId: string;
  code: string;
  discountType: string;
  discountValue: number;
  expiryDate: Date;
  createdAt: Date;
}

function toPublicVoucher(voucher: VoucherRecord): PublicVoucher {
  return {
    id: voucher.id,
    createdByAdminId: voucher.createdByAdminId,
    code: voucher.code,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    usageLimit: voucher.usageLimit,
    usageRemaining: voucher.usageRemaining,
    expiryDate: voucher.expiryDate,
    createdAt: voucher.createdAt,
  };
}

function toPublicPromo(promo: PromoRecord): PublicPromo {
  return {
    id: promo.id,
    createdByAdminId: promo.createdByAdminId,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    expiryDate: promo.expiryDate,
    createdAt: promo.createdAt,
  };
}

function throwIfCodeTaken(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ApiError(409, 'DISCOUNT_CODE_TAKEN', 'This code is already taken');
  }
  throw err;
}

export async function createVoucher(adminUserId: string, input: CreateVoucherInput): Promise<PublicVoucher> {
  try {
    const voucher = await prisma.voucher.create({
      data: {
        createdByAdminId: adminUserId,
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        usageLimit: input.usageLimit,
        usageRemaining: input.usageLimit,
        expiryDate: input.expiryDate,
      },
    });
    return toPublicVoucher(voucher);
  } catch (err) {
    return throwIfCodeTaken(err);
  }
}

export async function createPromo(adminUserId: string, input: CreatePromoInput): Promise<PublicPromo> {
  try {
    const promo = await prisma.promo.create({
      data: {
        createdByAdminId: adminUserId,
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        expiryDate: input.expiryDate,
      },
    });
    return toPublicPromo(promo);
  } catch (err) {
    return throwIfCodeTaken(err);
  }
}

export async function listVouchers(): Promise<PublicVoucher[]> {
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  return vouchers.map(toPublicVoucher);
}

export async function getVoucherById(id: string): Promise<PublicVoucher> {
  const voucher = await prisma.voucher.findUnique({ where: { id } });
  if (!voucher) {
    throw new ApiError(404, 'VOUCHER_NOT_FOUND', 'Voucher not found');
  }
  return toPublicVoucher(voucher);
}

export async function listPromos(): Promise<PublicPromo[]> {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: 'desc' } });
  return promos.map(toPublicPromo);
}

export async function getPromoById(id: string): Promise<PublicPromo> {
  const promo = await prisma.promo.findUnique({ where: { id } });
  if (!promo) {
    throw new ApiError(404, 'PROMO_NOT_FOUND', 'Promo not found');
  }
  return toPublicPromo(promo);
}

/**
 * Looks up a discount code, voucher first then promo (exact code match on
 * either table — codes are unique per-table but the two tables are not
 * mutually exclusive namespaces). Returns the computed discount amount for
 * a single discount applied to `subtotal`, reusing `computeDiscount` from
 * the money lib so the PERCENT-floor / FIXED-cap rules stay in one place.
 */
export async function validateDiscountCode(code: string, subtotal: number): Promise<ValidateDiscountResult> {
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  if (voucher) {
    if (voucher.expiryDate.getTime() < now().getTime()) {
      throw new ApiError(409, 'DISCOUNT_EXPIRED', 'Discount code has expired');
    }
    if (voucher.usageRemaining <= 0) {
      throw new ApiError(409, 'DISCOUNT_EXHAUSTED', 'Discount code has no uses remaining');
    }
    const discountInput: DiscountInput = {
      discountType: voucher.discountType as DiscountType,
      discountValue: voucher.discountValue,
    };
    const { voucherAmount } = computeDiscount(subtotal, discountInput);
    return {
      kind: 'VOUCHER',
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      amount: voucherAmount,
    };
  }

  const promo = await prisma.promo.findUnique({ where: { code } });
  if (promo) {
    if (promo.expiryDate.getTime() < now().getTime()) {
      throw new ApiError(409, 'DISCOUNT_EXPIRED', 'Discount code has expired');
    }
    const discountInput: DiscountInput = {
      discountType: promo.discountType as DiscountType,
      discountValue: promo.discountValue,
    };
    const { promoAmount } = computeDiscount(subtotal, undefined, discountInput);
    return {
      kind: 'PROMO',
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      amount: promoAmount,
    };
  }

  throw new ApiError(404, 'DISCOUNT_NOT_FOUND', 'Discount code not found');
}
