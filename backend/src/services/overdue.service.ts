import { prisma } from '../lib/prisma';
import { now } from '../lib/clock';
import { getOrCreateWallet } from './wallet.service';

/** Orders in either of these statuses are done and never candidates for the sweep. */
const FINAL_STATUSES = ['PESANAN_SELESAI', 'DIKEMBALIKAN'] as const;

/** DeliveryJob statuses that still represent "in flight" work to cancel. */
const CANCELLABLE_JOB_STATUSES = ['AVAILABLE', 'TAKEN'] as const;

export interface SweepResult {
  orderId: string;
  actions: string[];
}

/**
 * Idempotent overdue sweep: finds every order whose SLA deadline has passed
 * and that hasn't reached a final status yet, and forces each one to
 * DIKEMBALIKAN (returned), reversing every side effect the checkout made —
 * refund to wallet, stock restock, voucher quota restore, delivery job
 * cancellation — with an audit trail entry.
 *
 * Safe to call repeatedly (that's the point: `POST /simulate-next-day` calls
 * it after every day advance, and it's also exercised directly in tests to
 * prove idempotency): each order is processed in its own transaction, and
 * every mutation is guarded by a conditional `updateMany` keyed on the flag
 * it's about to flip (currentStatus, isRefunded, isStockRestored,
 * isVoucherRestored). A guard's `count === 0` means some earlier sweep (or a
 * concurrent one) already applied that specific effect, so this run skips
 * it — no double refund, no double restock, no double voucher credit, ever.
 */
export async function runOverdueSweep(): Promise<SweepResult[]> {
  const candidates = await prisma.order.findMany({
    where: {
      slaDeadline: { lt: now() },
      currentStatus: { notIn: [...FINAL_STATUSES] },
    },
    include: { items: true },
  });

  const results: SweepResult[] = [];

  for (const order of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      // Conditional guard on currentStatus itself: if this order somehow
      // reached a final status between the findMany read above and now
      // (e.g. the driver completed it, or a previous iteration of this same
      // sweep already returned it), this update is a no-op and we skip.
      const flip = await tx.order.updateMany({
        where: { id: order.id, currentStatus: { notIn: [...FINAL_STATUSES] } },
        data: { currentStatus: 'DIKEMBALIKAN' },
      });
      if (flip.count === 0) {
        return { orderId: order.id, actions: ['skipped: status changed concurrently'] };
      }

      const actions: string[] = ['status → DIKEMBALIKAN'];

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'DIKEMBALIKAN',
          changedByRole: 'SYSTEM',
          changedAt: now(),
        },
      });

      // Refund: guarded by isRefunded so re-running the sweep against an
      // already-returned order never credits the wallet twice.
      const refund = await tx.order.updateMany({
        where: { id: order.id, isRefunded: false },
        data: { isRefunded: true },
      });
      if (refund.count === 1) {
        const wallet = await getOrCreateWallet(order.buyerUserId, tx);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: order.finalTotal } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFUND',
            amount: order.finalTotal,
            orderId: order.id,
          },
        });
        actions.push(`refund ${order.finalTotal}`);
      }

      // Stock restore: guarded by isStockRestored so re-running never
      // increments product stock twice for the same order.
      const restock = await tx.order.updateMany({
        where: { id: order.id, isStockRestored: false },
        data: { isStockRestored: true },
      });
      if (restock.count === 1) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        actions.push('stock restored');
      }

      // Voucher quota restore: only applies if a voucher was used, guarded
      // by isVoucherRestored so re-running never credits usage twice.
      if (order.voucherId) {
        const voucherRestore = await tx.order.updateMany({
          where: { id: order.id, isVoucherRestored: false },
          data: { isVoucherRestored: true },
        });
        if (voucherRestore.count === 1) {
          await tx.voucher.update({
            where: { id: order.voucherId },
            data: { usageRemaining: { increment: 1 } },
          });
          actions.push('voucher quota restored');
        }
      }

      // Delivery job cancellation: naturally idempotent since the `in`
      // clause only matches AVAILABLE/TAKEN — a job already CANCELLED (from
      // a prior sweep run) or COMPLETED never matches again.
      const jobCancel = await tx.deliveryJob.updateMany({
        where: { orderId: order.id, status: { in: [...CANCELLABLE_JOB_STATUSES] } },
        data: { status: 'CANCELLED', driverEarning: 0 },
      });
      if (jobCancel.count > 0) {
        actions.push('delivery job cancelled');
      }

      return { orderId: order.id, actions };
    });

    results.push(result);
  }

  return results;
}

export interface OverdueOrderView {
  id: string;
  storeId: string;
  storeName: string;
  buyerUsername: string;
  currentStatus: string;
  finalTotal: number;
  slaDeadline: Date;
  createdAt: Date;
}

export interface OverdueView {
  pending: OverdueOrderView[];
  returned: OverdueOrderView[];
}

interface OverdueOrderRow {
  id: string;
  storeId: string;
  currentStatus: string;
  finalTotal: number;
  slaDeadline: Date;
  createdAt: Date;
  store: { storeName: string };
  buyer: { username: string };
}

function toOverdueOrderView(order: OverdueOrderRow): OverdueOrderView {
  return {
    id: order.id,
    storeId: order.storeId,
    storeName: order.store.storeName,
    buyerUsername: order.buyer.username,
    currentStatus: order.currentStatus,
    finalTotal: order.finalTotal,
    slaDeadline: order.slaDeadline,
    createdAt: order.createdAt,
  };
}

/**
 * Admin overview backing `GET /api/admin/overdue`: `pending` is every order
 * past its SLA deadline that the sweep hasn't caught up to yet (not in a
 * final status), `returned` is every order the sweep has already flipped to
 * DIKEMBALIKAN. Both include buyer/store identifiers so an admin can see who
 * and which store is affected without a follow-up lookup.
 */
export async function getOverdueView(): Promise<OverdueView> {
  const include = {
    store: { select: { storeName: true } },
    buyer: { select: { username: true } },
  } as const;

  const [pending, returned] = await Promise.all([
    prisma.order.findMany({
      where: { slaDeadline: { lt: now() }, currentStatus: { notIn: [...FINAL_STATUSES] } },
      orderBy: { slaDeadline: 'asc' },
      include,
    }),
    prisma.order.findMany({
      where: { currentStatus: 'DIKEMBALIKAN' },
      orderBy: { createdAt: 'desc' },
      include,
    }),
  ]);

  return {
    pending: pending.map(toOverdueOrderView),
    returned: returned.map(toOverdueOrderView),
  };
}
