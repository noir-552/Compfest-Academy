import { apiFetch } from './client';
import type { OrderDetail } from './buyer';

// Authenticated seller-only reads/writes. Mirrors
// backend/src/services/{store,product,order,report}.service.ts.

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
  imageUrl: string | null;
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
  imageUrl?: string | null;
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

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface SellerOrder extends OrderDetail {
  buyerUsername: string;
}

export function listIncomingOrders(): Promise<{ orders: SellerOrder[] }> {
  return apiFetch<{ orders: SellerOrder[] }>('/seller/orders');
}

/** Transitions SEDANG_DIKEMAS -> MENUNGGU_PENGIRIM. Throws 409 INVALID_STATUS if already processed. */
export function processOrder(id: string): Promise<{ order: SellerOrder }> {
  return apiFetch<{ order: SellerOrder }>(`/seller/orders/${id}/process`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface SellerReport {
  income: number;
  orderCount: number;
  byStatus: Record<string, number>;
}

export function getSellerReport(): Promise<SellerReport> {
  return apiFetch<SellerReport>('/seller/report');
}
