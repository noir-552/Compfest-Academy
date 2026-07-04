import type { Request, Response } from 'express';
import * as catalogService from '../services/catalog.service';

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const products = await catalogService.listPublicProducts({
    search: queryString(req.query.search),
    storeId: queryString(req.query.storeId),
  });
  res.status(200).json({ products });
}

export async function getProductHandler(req: Request, res: Response): Promise<void> {
  const product = await catalogService.getPublicProductById(req.params.id as string);
  res.status(200).json({ product });
}

export async function getStoreHandler(req: Request, res: Response): Promise<void> {
  const store = await catalogService.getPublicStoreById(req.params.id as string);
  res.status(200).json({ store });
}
