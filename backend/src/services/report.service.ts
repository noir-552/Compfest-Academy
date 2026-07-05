import { prisma } from '../lib/prisma';
import { getOwnStoreOrThrow } from './store.service';

export interface BuyerReport {
  totalSpent: number;
  orderCount: number;
  byStatus: Record<string, number>;
}

export interface SellerReport {
  income: number;
  orderCount: number;
  byStatus: Record<string, number>;
}

function countByStatus(orders: { currentStatus: string }[]): Record<string, number> {
  const byStatus: Record<string, number> = {};
  for (const order of orders) {
    byStatus[order.currentStatus] = (byStatus[order.currentStatus] ?? 0) + 1;
  }
  return byStatus;
}

/**
 * Buyer spend report. `totalSpent` intentionally excludes refunded orders
 * (a refunded order's money came back to the wallet, so it shouldn't count
 * as "spent"); `orderCount`/`byStatus` cover every order regardless of
 * refund state, since those describe order volume, not money retained.
 */
export async function getBuyerReport(buyerUserId: string): Promise<BuyerReport> {
  const orders = await prisma.order.findMany({
    where: { buyerUserId },
    select: { finalTotal: true, isRefunded: true, currentStatus: true },
  });

  const totalSpent = orders
    .filter((order) => !order.isRefunded)
    .reduce((sum, order) => sum + order.finalTotal, 0);

  return {
    totalSpent,
    orderCount: orders.length,
    byStatus: countByStatus(orders),
  };
}

/**
 * Seller income report, recognized-at-checkout: `income` is the seller's
 * cut of each non-refunded order (finalTotal minus the PPN remitted to tax
 * and the delivery fee that flows to the courier), not the full finalTotal
 * the buyer paid.
 */
export async function getSellerReport(sellerUserId: string): Promise<SellerReport> {
  const store = await getOwnStoreOrThrow(sellerUserId);

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    select: { finalTotal: true, ppnAmount: true, deliveryFee: true, isRefunded: true, currentStatus: true },
  });

  const income = orders
    .filter((order) => !order.isRefunded)
    .reduce((sum, order) => sum + (order.finalTotal - order.ppnAmount - order.deliveryFee), 0);

  return {
    income,
    orderCount: orders.length,
    byStatus: countByStatus(orders),
  };
}
