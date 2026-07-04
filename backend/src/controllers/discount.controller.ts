import type { Request, Response } from 'express';
import { z } from 'zod';
import * as discountService from '../services/discount.service';
import { ApiError } from '../lib/api-error';
import { now } from '../lib/clock';

const codeSchema = z
  .string()
  .regex(/^[A-Z0-9]{4,20}$/, 'Code must be 4-20 uppercase letters/digits');

const discountTypeSchema = z.enum(['PERCENT', 'FIXED']);

function isValidDiscountValue(discountType: 'PERCENT' | 'FIXED', discountValue: number): boolean {
  return discountType === 'PERCENT' ? discountValue >= 1 && discountValue <= 100 : discountValue >= 1;
}

const createVoucherSchema = z
  .object({
    code: codeSchema,
    discountType: discountTypeSchema,
    discountValue: z.number().int(),
    usageLimit: z.number().int().min(1),
    expiryDate: z.string().datetime(),
  })
  .refine((data) => isValidDiscountValue(data.discountType, data.discountValue), {
    message: 'discountValue out of range for discountType',
    path: ['discountValue'],
  })
  .refine((data) => new Date(data.expiryDate).getTime() > now().getTime(), {
    message: 'expiryDate must be in the future',
    path: ['expiryDate'],
  });

const createPromoSchema = z
  .object({
    code: codeSchema,
    discountType: discountTypeSchema,
    discountValue: z.number().int(),
    expiryDate: z.string().datetime(),
  })
  .refine((data) => isValidDiscountValue(data.discountType, data.discountValue), {
    message: 'discountValue out of range for discountType',
    path: ['discountValue'],
  })
  .refine((data) => new Date(data.expiryDate).getTime() > now().getTime(), {
    message: 'expiryDate must be in the future',
    path: ['expiryDate'],
  });

const validateDiscountSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().min(0),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function createVoucherHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = createVoucherSchema.parse(req.body);
  const voucher = await discountService.createVoucher(user.id, {
    code: input.code,
    discountType: input.discountType,
    discountValue: input.discountValue,
    usageLimit: input.usageLimit,
    expiryDate: new Date(input.expiryDate),
  });
  res.status(201).json({ voucher });
}

export async function createPromoHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = createPromoSchema.parse(req.body);
  const promo = await discountService.createPromo(user.id, {
    code: input.code,
    discountType: input.discountType,
    discountValue: input.discountValue,
    expiryDate: new Date(input.expiryDate),
  });
  res.status(201).json({ promo });
}

export async function listVouchersHandler(_req: Request, res: Response): Promise<void> {
  const vouchers = await discountService.listVouchers();
  res.status(200).json({ vouchers });
}

export async function getVoucherHandler(req: Request, res: Response): Promise<void> {
  const voucher = await discountService.getVoucherById(req.params.id as string);
  res.status(200).json({ voucher });
}

export async function listPromosHandler(_req: Request, res: Response): Promise<void> {
  const promos = await discountService.listPromos();
  res.status(200).json({ promos });
}

export async function getPromoHandler(req: Request, res: Response): Promise<void> {
  const promo = await discountService.getPromoById(req.params.id as string);
  res.status(200).json({ promo });
}

export async function validateDiscountHandler(req: Request, res: Response): Promise<void> {
  requireAuth(req);
  const input = validateDiscountSchema.parse(req.body);
  const result = await discountService.validateDiscountCode(input.code, input.subtotal);
  res.status(200).json(result);
}
