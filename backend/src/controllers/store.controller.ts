import type { Request, Response } from 'express';
import { z } from 'zod';
import * as storeService from '../services/store.service';
import { ApiError } from '../lib/api-error';

const storeSchema = z.object({
  storeName: z.string().min(3).max(50),
  description: z.string().max(2000).optional(),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function getStoreHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const store = await storeService.getOwnStoreOrThrow(user.id);
  res.status(200).json({ store });
}

export async function createStoreHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = storeSchema.parse(req.body);
  const store = await storeService.createStore(user.id, input);
  res.status(201).json({ store });
}

export async function updateStoreHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = storeSchema.parse(req.body);
  const store = await storeService.updateStore(user.id, input);
  res.status(200).json({ store });
}
