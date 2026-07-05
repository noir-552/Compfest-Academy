import { apiFetch } from './client';

// Public catalog reads — no auth token required (apiFetch attaches one if
// present, but the backend routes ignore it). Mirrors backend/src/services/catalog.service.ts.

export interface PublicStoreRef {
  id: string;
  storeName: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  store: PublicStoreRef;
}

export interface PublicProductDetail extends Omit<PublicProduct, 'store'> {
  description: string | null;
  store: PublicStoreRef & { description: string | null };
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
}

export interface PublicStoreDetail {
  id: string;
  storeName: string;
  description: string | null;
  products: PublicStoreProduct[];
}

export interface ListProductsParams {
  search?: string;
  storeId?: string;
}

export function listProducts(params: ListProductsParams = {}): Promise<{ products: PublicProduct[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.storeId) query.set('storeId', params.storeId);
  const qs = query.toString();
  return apiFetch<{ products: PublicProduct[] }>(`/products${qs ? `?${qs}` : ''}`);
}

export function getProduct(id: string): Promise<{ product: PublicProductDetail }> {
  return apiFetch<{ product: PublicProductDetail }>(`/products/${id}`);
}

export function getStore(id: string): Promise<{ store: PublicStoreDetail }> {
  return apiFetch<{ store: PublicStoreDetail }>(`/stores/${id}`);
}
