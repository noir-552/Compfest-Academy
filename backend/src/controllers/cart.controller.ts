import type { Request, Response } from 'express';
import { z } from 'zod';
import * as cartService from '../services/cart.service';
import { ApiError } from '../lib/api-error';

const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(1),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const cart = await cartService.getCart(user.id);
  res.status(200).json({ cart });
}

export async function addItemHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = addItemSchema.parse(req.body);
  const cart = await cartService.addItem(user.id, input.productId, input.quantity);
  res.status(200).json({ cart });
}

export async function updateItemHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = updateQuantitySchema.parse(req.body);
  const cart = await cartService.updateItemQuantity(user.id, req.params.productId as string, input.quantity);
  res.status(200).json({ cart });
}

export async function removeItemHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const cart = await cartService.removeItem(user.id, req.params.productId as string);
  res.status(200).json({ cart });
}

export async function clearCartHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const cart = await cartService.clearCart(user.id);
  res.status(200).json({ cart });
}
