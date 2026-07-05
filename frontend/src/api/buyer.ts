import { apiFetch } from './client';

// Authenticated buyer-only reads/writes. Mirrors backend/src/services/{wallet,address,cart,checkout,order}.service.ts
// and backend/src/routes/buyer.routes.ts.

export type DeliveryMethod = 'INSTANT' | 'NEXT_DAY' | 'REGULAR';

export const DELIVERY_FEES: Record<DeliveryMethod, number> = {
  INSTANT: 25000,
  NEXT_DAY: 15000,
  REGULAR: 10000,
};

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  INSTANT: 'Instan',
  NEXT_DAY: 'Besok Sampai',
  REGULAR: 'Reguler',
};

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export interface Wallet {
  balance: number;
}

export interface WalletTransaction {
  id: string;
  orderId: string | null;
  type: string;
  amount: number;
  createdAt: string;
}

export interface WalletWithTransactions {
  wallet: Wallet;
  transactions: WalletTransaction[];
}

export function getWallet(): Promise<WalletWithTransactions> {
  return apiFetch<WalletWithTransactions>('/buyer/wallet');
}

export function topupWallet(amount: number): Promise<WalletWithTransactions> {
  return apiFetch<WalletWithTransactions>('/buyer/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  isDefault: boolean;
}

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  isDefault?: boolean;
}

export function listAddresses(): Promise<{ addresses: Address[] }> {
  return apiFetch<{ addresses: Address[] }>('/buyer/addresses');
}

export function createAddress(input: AddressInput): Promise<{ address: Address }> {
  return apiFetch<{ address: Address }>('/buyer/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAddress(id: string, input: Partial<AddressInput>): Promise<{ address: Address }> {
  return apiFetch<{ address: Address }>(`/buyer/addresses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteAddress(id: string): Promise<Record<string, never>> {
  return apiFetch<Record<string, never>>(`/buyer/addresses/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export interface CartProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
  lineTotal: number;
}

export interface CartStoreRef {
  id: string;
  storeName: string;
}

export interface Cart {
  storeId: string | null;
  store: CartStoreRef | null;
  items: CartItem[];
  subtotal: number;
}

export function getCart(): Promise<{ cart: Cart }> {
  return apiFetch<{ cart: Cart }>('/buyer/cart');
}

export function addCartItem(productId: string, quantity: number): Promise<{ cart: Cart }> {
  return apiFetch<{ cart: Cart }>('/buyer/cart/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export function updateCartItem(productId: string, quantity: number): Promise<{ cart: Cart }> {
  return apiFetch<{ cart: Cart }>(`/buyer/cart/items/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(productId: string): Promise<{ cart: Cart }> {
  return apiFetch<{ cart: Cart }>(`/buyer/cart/items/${productId}`, { method: 'DELETE' });
}

export function clearCart(): Promise<{ cart: Cart }> {
  return apiFetch<{ cart: Cart }>('/buyer/cart', { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CheckoutInput {
  addressId: string;
  deliveryMethod: DeliveryMethod;
  voucherCode?: string;
  promoCode?: string;
}

export interface CheckoutPreviewLineItem {
  productId: string;
  productNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface CheckoutTotals {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
}

export interface DiscountLineView {
  code: string;
  amount: number;
}

export interface DiscountBreakdown {
  voucher: DiscountLineView | null;
  promo: DiscountLineView | null;
}

export interface CheckoutPreview {
  storeId: string;
  items: CheckoutPreviewLineItem[];
  totals: CheckoutTotals;
  discounts: DiscountBreakdown;
}

export function previewCheckout(input: CheckoutInput): Promise<CheckoutPreview> {
  return apiFetch<CheckoutPreview>('/buyer/checkout/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function checkout(input: CheckoutInput): Promise<{ order: OrderDetail }> {
  return apiFetch<{ order: OrderDetail }>('/buyer/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: string;
  changedByRole: string;
  changedAt: string;
}

export interface OrderSummary {
  id: string;
  storeId: string;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
  currentStatus: string;
  slaDeadline: string;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  addressId: string;
  recipientNameSnapshot: string;
  phoneSnapshot: string;
  fullAddressSnapshot: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export function listOrders(): Promise<{ orders: OrderSummary[] }> {
  return apiFetch<{ orders: OrderSummary[] }>('/buyer/orders');
}

export function getOrder(id: string): Promise<{ order: OrderDetail }> {
  return apiFetch<{ order: OrderDetail }>(`/buyer/orders/${id}`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface BuyerReport {
  totalSpent: number;
  orderCount: number;
  byStatus: Record<string, number>;
}

export function getBuyerReport(): Promise<BuyerReport> {
  return apiFetch<BuyerReport>('/buyer/report');
}
