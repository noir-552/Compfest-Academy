import { apiFetch } from './client';

// Authenticated seller-only reads/writes. Mirrors backend/src/services/{store,product}.service.ts.

export interface SellerStore {
  id: string;
  storeName: string;
  description: string | null;
  createdAt: string;
}

export interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isDeleted: boolean;
  createdAt: string;
}

export interface StoreInput {
  storeName: string;
  description?: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
}

export function getOwnStore(): Promise<{ store: SellerStore }> {
  return apiFetch<{ store: SellerStore }>('/seller/store');
}

export function createStore(input: StoreInput): Promise<{ store: SellerStore }> {
  return apiFetch<{ store: SellerStore }>('/seller/store', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStore(input: StoreInput): Promise<{ store: SellerStore }> {
  return apiFetch<{ store: SellerStore }>('/seller/store', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listOwnProducts(): Promise<{ products: SellerProduct[] }> {
  return apiFetch<{ products: SellerProduct[] }>('/seller/products');
}

export function createProduct(input: ProductInput): Promise<{ product: SellerProduct }> {
  return apiFetch<{ product: SellerProduct }>('/seller/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: ProductInput): Promise<{ product: SellerProduct }> {
  return apiFetch<{ product: SellerProduct }>(`/seller/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string): Promise<Record<string, never>> {
  return apiFetch<Record<string, never>>(`/seller/products/${id}`, { method: 'DELETE' });
}
