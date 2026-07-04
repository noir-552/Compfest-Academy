import type { Request, Response } from 'express';
import { z } from 'zod';
import * as walletService from '../services/wallet.service';
import { ApiError } from '../lib/api-error';

const topupSchema = z.object({
  amount: z.number().int().min(1).max(100_000_000),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function getWalletHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const result = await walletService.getWalletWithTransactions(user.id);
  res.status(200).json(result);
}

export async function topupHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = topupSchema.parse(req.body);
  const result = await walletService.topup(user.id, input.amount);
  res.status(200).json(result);
}
