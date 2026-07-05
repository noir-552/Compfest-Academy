import { apiFetch } from './client';
import type { DiscountValueType } from './discounts';

// Authenticated admin-only reads/writes. Mirrors
// backend/src/services/admin.service.ts, backend/src/services/discount.service.ts,
// backend/src/services/overdue.service.ts, and backend/src/routes/admin.routes.ts.

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface AdminCounts {
  users: number;
  stores: number;
  products: number;
  ordersByStatus: Record<string, number>;
  vouchers: number;
  promos: number;
  jobsByStatus: Record<string, number>;
  overduePending: number;
}

export interface AdminOverview {
  virtualDate: string;
  counts: AdminCounts;
}

export function getOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>('/admin/overview');
}

// ---------------------------------------------------------------------------
// Users / Stores / Products / Orders / Delivery jobs
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  roles: string[];
  createdAt: string;
}

export interface AdminStore {
  id: string;
  storeName: string;
  description: string | null;
  sellerUsername: string;
  productCount: number;
  createdAt: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  isDeleted: boolean;
  storeName: string;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  buyerUsername: string;
  storeName: string;
  currentStatus: string;
  finalTotal: number;
  createdAt: string;
}

export interface AdminDeliveryJob {
  id: string;
  orderId: string;
  driverUsername: string | null;
  status: string;
  driverEarning: number;
  createdAt: string;
}

export function listUsers(): Promise<{ users: AdminUser[] }> {
  return apiFetch<{ users: AdminUser[] }>('/admin/users');
}

export function listStores(): Promise<{ stores: AdminStore[] }> {
  return apiFetch<{ stores: AdminStore[] }>('/admin/stores');
}

export function listProducts(): Promise<{ products: AdminProduct[] }> {
  return apiFetch<{ products: AdminProduct[] }>('/admin/products');
}

export function listOrders(): Promise<{ orders: AdminOrder[] }> {
  return apiFetch<{ orders: AdminOrder[] }>('/admin/orders');
}

export function listDeliveryJobs(): Promise<{ jobs: AdminDeliveryJob[] }> {
  return apiFetch<{ jobs: AdminDeliveryJob[] }>('/admin/delivery-jobs');
}

// ---------------------------------------------------------------------------
// Vouchers / Promos
// ---------------------------------------------------------------------------

export interface Voucher {
  id: string;
  code: string;
  discountType: DiscountValueType;
  discountValue: number;
  usageLimit: number;
  usageRemaining: number;
  expiryDate: string;
  createdAt: string;
}

export interface Promo {
  id: string;
  code: string;
  discountType: DiscountValueType;
  discountValue: number;
  expiryDate: string;
  createdAt: string;
}

export interface CreateVoucherInput {
  code: string;
  discountType: DiscountValueType;
  discountValue: number;
  usageLimit: number;
  expiryDate: string;
}

export interface CreatePromoInput {
  code: string;
  discountType: DiscountValueType;
  discountValue: number;
  expiryDate: string;
}

export function createVoucher(input: CreateVoucherInput): Promise<{ voucher: Voucher }> {
  return apiFetch<{ voucher: Voucher }>('/admin/vouchers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listVouchers(): Promise<{ vouchers: Voucher[] }> {
  return apiFetch<{ vouchers: Voucher[] }>('/admin/vouchers');
}

export function getVoucher(id: string): Promise<{ voucher: Voucher }> {
  return apiFetch<{ voucher: Voucher }>(`/admin/vouchers/${id}`);
}

export function createPromo(input: CreatePromoInput): Promise<{ promo: Promo }> {
  return apiFetch<{ promo: Promo }>('/admin/promos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listPromos(): Promise<{ promos: Promo[] }> {
  return apiFetch<{ promos: Promo[] }>('/admin/promos');
}

export function getPromo(id: string): Promise<{ promo: Promo }> {
  return apiFetch<{ promo: Promo }>(`/admin/promos/${id}`);
}

// ---------------------------------------------------------------------------
// Time simulation + overdue sweep
// ---------------------------------------------------------------------------

export interface SweepResult {
  orderId: string;
  actions: string[];
}

export interface SimulateNextDayResult {
  virtualDate: string;
  processed: SweepResult[];
}

export function simulateNextDay(): Promise<SimulateNextDayResult> {
  return apiFetch<SimulateNextDayResult>('/admin/simulate-next-day', { method: 'POST' });
}

export interface OverdueOrder {
  id: string;
  storeId: string;
  storeName: string;
  buyerUsername: string;
  currentStatus: string;
  finalTotal: number;
  slaDeadline: string;
  createdAt: string;
}

export interface OverdueView {
  pending: OverdueOrder[];
  returned: OverdueOrder[];
}

export function getOverdue(): Promise<OverdueView> {
  return apiFetch<OverdueView>('/admin/overdue');
}
