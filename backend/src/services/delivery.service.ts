import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { now } from '../lib/clock';

/** Either the global singleton client or an interactive transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface DriverOrderSummary {
  id: string;
  storeName: string;
  deliveryMethod: string;
  deliveryFee: number;
  fullAddressSnapshot: string;
  recipientNameSnapshot: string;
  /** Total quantity across all order items (same convention as the buyer cart badge). */
  itemCount: number;
}

export interface DriverJobView {
  id: string;
  status: string;
  driverEarning: number;
  takenAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  order: DriverOrderSummary;
}

export interface DriverEarningLine {
  id: string;
  orderId: string;
  driverEarning: number;
  completedAt: Date | null;
}

export interface DriverEarningsView {
  totalEarnings: number;
  completedCount: number;
  jobs: DriverEarningLine[];
}

/** The shape returned by every job query below (`include` is identical each time). */
type JobWithOrder = Prisma.DeliveryJobGetPayload<{
  include: { order: { include: { store: true; items: true } } };
}>;

const jobInclude = {
  order: { include: { store: true, items: true } },
} satisfies Prisma.DeliveryJobInclude;

function toOrderSummary(order: JobWithOrder['order']): DriverOrderSummary {
  return {
    id: order.id,
    storeName: order.store.storeName,
    deliveryMethod: order.deliveryMethod,
    deliveryFee: order.deliveryFee,
    fullAddressSnapshot: order.fullAddressSnapshot,
    recipientNameSnapshot: order.recipientNameSnapshot,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function toJobView(job: JobWithOrder): DriverJobView {
  return {
    id: job.id,
    status: job.status,
    driverEarning: job.driverEarning,
    takenAt: job.takenAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    order: toOrderSummary(job.order),
  };
}

/**
 * Creates the AVAILABLE delivery job for a freshly-processed order. Called
 * from `order.service.processOrder`'s transaction so the job row and the
 * SEDANG_DIKEMAS -> MENUNGGU_PENGIRIM flip are atomic: a reader can never
 * observe a MENUNGGU_PENGIRIM order with no corresponding job, or vice versa.
 */
export async function createDeliveryJobForOrder(tx: Db, orderId: string): Promise<void> {
  await tx.deliveryJob.create({ data: { orderId, status: 'AVAILABLE' } });
}

export async function listAvailableJobs(): Promise<DriverJobView[]> {
  const jobs = await prisma.deliveryJob.findMany({
    where: { status: 'AVAILABLE' },
    orderBy: { createdAt: 'desc' },
    include: jobInclude,
  });
  return jobs.map(toJobView);
}

export interface DriverMineView {
  active: DriverJobView | null;
  history: DriverJobView[];
}

export async function getMyJobs(driverUserId: string): Promise<DriverMineView> {
  const [active, history] = await Promise.all([
    prisma.deliveryJob.findFirst({
      where: { driverUserId, status: 'TAKEN' },
      include: jobInclude,
    }),
    prisma.deliveryJob.findMany({
      where: { driverUserId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      include: jobInclude,
    }),
  ]);

  return {
    active: active ? toJobView(active) : null,
    history: history.map(toJobView),
  };
}

/**
 * A job is visible to a driver either while it's up for grabs (AVAILABLE),
 * or once they own it (any status) — never someone else's taken/completed
 * job. Both "doesn't exist" and "not visible to this driver" collapse to
 * the same 404 so a driver can't probe for other drivers' job IDs.
 */
export async function getJobDetail(driverUserId: string, jobId: string): Promise<DriverJobView> {
  const job = await prisma.deliveryJob.findUnique({ where: { id: jobId }, include: jobInclude });

  if (!job || (job.status !== 'AVAILABLE' && job.driverUserId !== driverUserId)) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Delivery job not found');
  }

  return toJobView(job);
}

/**
 * Race-safe job taking — the one graded rule in this feature. Two drivers
 * hitting `take` on the same job concurrently can never both win: the
 * conditional `updateMany` (id + status: AVAILABLE + driverUserId: null all
 * in the WHERE clause) means only the first writer's transaction flips the
 * row: the loser's `count` comes back 0 and it throws 409, leaving the
 * winner's driverUserId/status untouched.
 */
export async function takeJob(driverUserId: string, jobId: string): Promise<DriverJobView> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.deliveryJob.findUnique({ where: { id: jobId }, include: { order: true } });
    if (!job) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Delivery job not found');
    }

    if (job.order.buyerUserId === driverUserId) {
      throw new ApiError(403, 'SELF_DELIVERY_FORBIDDEN', 'You cannot deliver your own order');
    }

    const activeCount = await tx.deliveryJob.count({ where: { driverUserId, status: 'TAKEN' } });
    if (activeCount > 0) {
      throw new ApiError(409, 'DRIVER_BUSY', 'Selesaikan job aktif dulu sebelum mengambil job baru');
    }

    const taken = await tx.deliveryJob.updateMany({
      where: { id: jobId, status: 'AVAILABLE', driverUserId: null },
      data: { status: 'TAKEN', driverUserId, takenAt: now() },
    });
    if (taken.count === 0) {
      throw new ApiError(409, 'JOB_ALREADY_TAKEN', 'This job has already been taken');
    }

    await tx.order.updateMany({
      where: { id: job.orderId, currentStatus: 'MENUNGGU_PENGIRIM' },
      data: { currentStatus: 'SEDANG_DIKIRIM' },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: job.orderId, status: 'SEDANG_DIKIRIM', changedByRole: 'DRIVER' },
    });

    const updated = await tx.deliveryJob.findUniqueOrThrow({ where: { id: jobId }, include: jobInclude });
    return toJobView(updated);
  });
}

/**
 * Completing a job is likewise guarded by a conditional `updateMany` (id +
 * status: TAKEN + driverUserId: <this driver>) so it can only ever succeed
 * once for a given job, mirroring `takeJob`'s race-safety.
 */
export async function completeJob(driverUserId: string, jobId: string): Promise<DriverJobView> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.deliveryJob.findUnique({ where: { id: jobId }, include: { order: true } });
    if (!job) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Delivery job not found');
    }

    if (job.driverUserId !== driverUserId) {
      throw new ApiError(403, 'NOT_YOUR_JOB', 'This job is not assigned to you');
    }

    const driverEarning = Math.floor(0.8 * job.order.deliveryFee);
    const completed = await tx.deliveryJob.updateMany({
      where: { id: jobId, status: 'TAKEN', driverUserId },
      data: { status: 'COMPLETED', completedAt: now(), driverEarning },
    });
    if (completed.count === 0) {
      throw new ApiError(409, 'INVALID_STATUS', `Job status is ${job.status}, expected TAKEN`);
    }

    await tx.order.updateMany({
      where: { id: job.orderId, currentStatus: 'SEDANG_DIKIRIM' },
      data: { currentStatus: 'PESANAN_SELESAI' },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: job.orderId, status: 'PESANAN_SELESAI', changedByRole: 'DRIVER' },
    });

    const updated = await tx.deliveryJob.findUniqueOrThrow({ where: { id: jobId }, include: jobInclude });
    return toJobView(updated);
  });
}

export async function getEarnings(driverUserId: string): Promise<DriverEarningsView> {
  const jobs = await prisma.deliveryJob.findMany({
    where: { driverUserId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });

  return {
    totalEarnings: jobs.reduce((sum, job) => sum + job.driverEarning, 0),
    completedCount: jobs.length,
    jobs: jobs.map((job) => ({
      id: job.id,
      orderId: job.orderId,
      driverEarning: job.driverEarning,
      completedAt: job.completedAt,
    })),
  };
}
