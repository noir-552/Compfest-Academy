import type { Request, Response } from 'express';
import { z } from 'zod';
import * as productService from '../services/product.service';
import { ApiError } from '../lib/api-error';

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/'),
    { message: 'imageUrl must start with https://, http://, or /' },
  );

const productSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0),
  stock: z.number().int().min(0),
  imageUrl: imageUrlSchema.nullable().optional(),
});

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const products = await productService.listOwnProducts(user.id);
  res.status(200).json({ products });
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = productSchema.parse(req.body);
  const product = await productService.createProduct(user.id, input);
  res.status(201).json({ product });
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const input = productSchema.parse(req.body);
  const product = await productService.updateProduct(user.id, req.params.id as string, input);
  res.status(200).json({ product });
}

export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  await productService.deleteProduct(user.id, req.params.id as string);
  res.status(200).json({});
}
