import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { SLA_DAYS } from '../lib/money';
import type { DeliveryMethod } from '../lib/money';
import { now } from '../lib/clock';
import { getOwnStoreOrThrow } from './store.service';
import { createDeliveryJobForOrder } from './delivery.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Computes the SLA deadline for a freshly-created order, anchored to
 * `now()` (see `src/lib/clock.ts` — Level 6 swaps in a virtual clock there).
 */
export function computeSlaDeadline(method: DeliveryMethod): Date {
  return new Date(now().getTime() + SLA_DAYS[method] * MS_PER_DAY);
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
  voucherId: string | null;
  promoId: string | null;
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
  voucherId: string | null;
  promoId: string | null;
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
    voucherId: order.voucherId,
    promoId: order.promoId,
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

/**
 * Shared mapper from a full Prisma order row (+ items + statusHistory) to
 * the `OrderDetail` view. Used by every path that returns a complete order
 * — buyer detail, checkout's own response, and seller status transitions —
 * so the field list lives in exactly one place.
 */
function toDetail(order: {
  id: string;
  storeId: string;
  voucherId: string | null;
  promoId: string | null;
  deliveryMethod: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
  currentStatus: string;
  slaDeadline: Date;
  createdAt: Date;
  addressId: string;
  recipientNameSnapshot: string;
  phoneSnapshot: string;
  fullAddressSnapshot: string;
  items: Parameters<typeof toItemView>[0][];
  statusHistory: Parameters<typeof toHistoryView>[0][];
}): OrderDetail {
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

export { toDetail as toOrderDetail };

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

  return toDetail(order);
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
    ...toDetail(order),
    buyerUsername: order.buyer.username,
  }));
}

/**
 * Race-safe seller-side status transition: SEDANG_DIKEMAS -> MENUNGGU_PENGIRIM.
 * The conditional `updateMany` guard (id + storeId + currentStatus all in
 * the WHERE clause) means two concurrent calls can never both succeed —
 * only one flips the row, so exactly one status-history entry is written.
 * On a miss we distinguish "wrong status" (409) from "not this seller's
 * order at all" (404) with a follow-up read of just the ownership scope.
 */
export async function processOrder(sellerUserId: string, orderId: string): Promise<OrderDetail> {
  const store = await getOwnStoreOrThrow(sellerUserId);

  return prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, storeId: store.id, currentStatus: 'SEDANG_DIKEMAS' },
      data: { currentStatus: 'MENUNGGU_PENGIRIM' },
    });

    if (result.count === 0) {
      const existing = await tx.order.findFirst({ where: { id: orderId, storeId: store.id } });
      if (existing) {
        throw new ApiError(
          409,
          'INVALID_STATUS',
          `Order status is ${existing.currentStatus}, expected SEDANG_DIKEMAS`,
        );
      }
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    await tx.orderStatusHistory.create({
      data: { orderId, status: 'MENUNGGU_PENGIRIM', changedByRole: 'SELLER', changedAt: now() },
    });

    await createDeliveryJobForOrder(tx, orderId);

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: true,
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    return toDetail(order);
  });
}
