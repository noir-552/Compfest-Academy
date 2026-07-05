import type { Request, Response } from 'express';
import { z } from 'zod';
import * as checkoutService from '../services/checkout.service';
import { ApiError } from '../lib/api-error';

const deliveryMethodSchema = z.enum(['INSTANT', 'NEXT_DAY', 'REGULAR']);

const checkoutSchema = z.object({
  addressId: z.string().min(1),
  deliveryMethod: deliveryMethodSchema,
  voucherCode: z.string().min(1).optional(),
  promoCode: z.string().min(1).optional(),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function previewCheckoutHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = checkoutSchema.parse(req.body);
  const preview = await checkoutService.previewCheckout(user.id, input);
  res.status(200).json(preview);
}

export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = checkoutSchema.parse(req.body);
  const order = await checkoutService.checkout(user.id, input);
  res.status(201).json({ order });
}
