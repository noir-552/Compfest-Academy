import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { SLA_DAYS } from '../lib/money';
import type { DeliveryMethod } from '../lib/money';
import { getOwnStoreOrThrow } from './store.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Computes the SLA deadline for a freshly-created order.
 * Level 3 anchors to the real wall clock (`new Date()`); Level 6 introduces
 * a virtual clock, at which point only this function needs to change to
 * accept/return against `virtualNow()` instead.
 */
export function computeSlaDeadline(method: DeliveryMethod): Date {
  return new Date(Date.now() + SLA_DAYS[method] * MS_PER_DAY);
}

export interface OrderItemView {
  id: string;
  productId: string;
  productNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
}

export interface OrderStatusHistoryView {
  id: string;
  status: string;
  changedByRole: string;
  changedAt: Date;
}

export interface OrderSummary {
  id: string;
  storeId: string;
  deliveryMethod: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
  currentStatus: string;
  slaDeadline: Date;
  createdAt: Date;
}

export interface OrderDetail extends OrderSummary {
  addressId: string;
  recipientNameSnapshot: string;
  phoneSnapshot: string;
  fullAddressSnapshot: string;
  items: OrderItemView[];
  statusHistory: OrderStatusHistoryView[];
}

export interface SellerOrderView extends OrderDetail {
  buyerUsername: string;
}

function toItemView(item: {
  id: string;
  productId: string;
  productNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
}): OrderItemView {
  return {
    id: item.id,
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    priceSnapshot: item.priceSnapshot,
    quantity: item.quantity,
  };
}

function toHistoryView(entry: {
  id: string;
  status: string;
  changedByRole: string;
  changedAt: Date;
}): OrderStatusHistoryView {
  return {
    id: entry.id,
    status: entry.status,
    changedByRole: entry.changedByRole,
    changedAt: entry.changedAt,
  };
}

function toSummary(order: {
  id: string;
  storeId: string;
  deliveryMethod: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
  currentStatus: string;
  slaDeadline: Date;
  createdAt: Date;
}): OrderSummary {
  return {
    id: order.id,
    storeId: order.storeId,
    deliveryMethod: order.deliveryMethod,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    deliveryFee: order.deliveryFee,
    ppnAmount: order.ppnAmount,
    finalTotal: order.finalTotal,
    currentStatus: order.currentStatus,
    slaDeadline: order.slaDeadline,
    createdAt: order.createdAt,
  };
}

export async function listOwnOrders(buyerUserId: string): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { buyerUserId },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(toSummary);
}

export async function getOwnOrderDetail(buyerUserId: string, orderId: string): Promise<OrderDetail> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId },
    include: {
      items: true,
      statusHistory: { orderBy: { changedAt: 'asc' } },
    },
  });

  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  return {
    ...toSummary(order),
    addressId: order.addressId,
    recipientNameSnapshot: order.recipientNameSnapshot,
    phoneSnapshot: order.phoneSnapshot,
    fullAddressSnapshot: order.fullAddressSnapshot,
    items: order.items.map(toItemView),
    statusHistory: order.statusHistory.map(toHistoryView),
  };
}

export async function listIncomingOrders(sellerUserId: string): Promise<SellerOrderView[]> {
  const store = await getOwnStoreOrThrow(sellerUserId);

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      statusHistory: { orderBy: { changedAt: 'asc' } },
      buyer: { select: { username: true } },
    },
  });

  return orders.map((order) => ({
    ...toSummary(order),
    addressId: order.addressId,
    recipientNameSnapshot: order.recipientNameSnapshot,
    phoneSnapshot: order.phoneSnapshot,
    fullAddressSnapshot: order.fullAddressSnapshot,
    items: order.items.map(toItemView),
    statusHistory: order.statusHistory.map(toHistoryView),
    buyerUsername: order.buyer.username,
  }));
}
