import type { Request, Response } from 'express';
import { z } from 'zod';
import * as addressService from '../services/address.service';
import { ApiError } from '../lib/api-error';

const phoneSchema = z.string().regex(/^\d{8,15}$/, 'Phone must be 8-15 digits');

const createAddressSchema = z.object({
  label: z.string().min(1).max(50),
  recipientName: z.string().min(1).max(100),
  phone: phoneSchema,
  fullAddress: z.string().min(1).max(500),
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  recipientName: z.string().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  fullAddress: z.string().min(1).max(500).optional(),
  isDefault: z.boolean().optional(),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function listAddressesHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const addresses = await addressService.listOwnAddresses(user.id);
  res.status(200).json({ addresses });
}

export async function createAddressHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = createAddressSchema.parse(req.body);
  const address = await addressService.createAddress(user.id, input);
  res.status(201).json({ address });
}

export async function updateAddressHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = updateAddressSchema.parse(req.body);
  const address = await addressService.updateAddress(user.id, req.params.id as string, input);
  res.status(200).json({ address });
}

export async function deleteAddressHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  await addressService.deleteAddress(user.id, req.params.id as string);
  res.status(200).json({});
}
