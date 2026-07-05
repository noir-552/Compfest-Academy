import { prisma } from '../lib/prisma';
import { getVirtualDate } from '../lib/clock';

/** Every status an Order can be in — used to zero-fill `ordersByStatus` so the overview always reports a literal count (0 if none) rather than omitting the key. */
const ORDER_STATUSES = [
  'SEDANG_DIKEMAS',
  'MENUNGGU_PENGIRIM',
  'SEDANG_DIKIRIM',
  'PESANAN_SELESAI',
  'DIKEMBALIKAN',
] as const;

/** Every status a DeliveryJob can be in — same zero-fill rationale as `ORDER_STATUSES`. */
const JOB_STATUSES = ['AVAILABLE', 'TAKEN', 'COMPLETED', 'CANCELLED'] as const;

/** Orders in either of these statuses are done and can never be "overdue pending" — mirrors overdue.service's FINAL_STATUSES. */
const FINAL_STATUSES = ['PESANAN_SELESAI', 'DIKEMBALIKAN'] as const;

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
  virtualDate: Date;
  counts: AdminCounts;
}

/**
 * Top-line counts for the admin dashboard's overview tab: entity totals plus
 * status breakdowns for orders/delivery jobs, and how many orders are past
 * their SLA deadline but not yet swept. Wires in `getVirtualDate()` so the
 * dashboard can show "today" as the app sees it (real time + simulated day
 * offset), not the host machine's wall clock.
 */
export async function getOverview(): Promise<AdminOverview> {
  const virtualDate = getVirtualDate();

  const [
    users,
    stores,
    products,
    orderStatusGroups,
    vouchers,
    promos,
    jobStatusGroups,
    overduePending,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.product.count(),
    prisma.order.groupBy({ by: ['currentStatus'], _count: { _all: true } }),
    prisma.voucher.count(),
    prisma.promo.count(),
    prisma.deliveryJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.count({
      where: { slaDeadline: { lt: virtualDate }, currentStatus: { notIn: [...FINAL_STATUSES] } },
    }),
  ]);

  const ordersByStatus: Record<string, number> = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  );
  for (const group of orderStatusGroups) {
    ordersByStatus[group.currentStatus] = group._count._all;
  }

  const jobsByStatus: Record<string, number> = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0]));
  for (const group of jobStatusGroups) {
    jobsByStatus[group.status] = group._count._all;
  }

  return {
    virtualDate,
    counts: {
      users,
      stores,
      products,
      ordersByStatus,
      vouchers,
      promos,
      jobsByStatus,
      overduePending,
    },
  };
}

export interface AdminUserView {
  id: string;
  username: string;
  email: string;
  phone: string;
  roles: string[];
  createdAt: Date;
}

/** All registered users with their roles, deliberately excluding `passwordHash`. */
export async function listUsers(): Promise<AdminUserView[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { roles: true },
  });
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    roles: user.roles.map((r) => r.roleType),
    createdAt: user.createdAt,
  }));
}

export interface AdminStoreView {
  id: string;
  storeName: string;
  description: string | null;
  sellerUsername: string;
  productCount: number;
  createdAt: Date;
}

/** Every store with its seller's username and live product count. */
export async function listStores(): Promise<AdminStoreView[]> {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: { seller: { select: { username: true } }, _count: { select: { products: true } } },
  });
  return stores.map((store) => ({
    id: store.id,
    storeName: store.storeName,
    description: store.description,
    sellerUsername: store.seller.username,
    productCount: store._count.products,
    createdAt: store.createdAt,
  }));
}

export interface AdminProductView {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  isDeleted: boolean;
  storeName: string;
  createdAt: Date;
}

/** Every product (including soft-deleted ones, flagged via `isDeleted`) with its store's name. */
export async function listProducts(): Promise<AdminProductView[]> {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { store: { select: { storeName: true } } },
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    isDeleted: product.isDeleted,
    storeName: product.store.storeName,
    createdAt: product.createdAt,
  }));
}

export interface AdminOrderView {
  id: string;
  buyerUsername: string;
  storeName: string;
  currentStatus: string;
  finalTotal: number;
  createdAt: Date;
}

/** Every order, newest first, with buyer/store identifiers for at-a-glance monitoring. */
export async function listOrders(): Promise<AdminOrderView[]> {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { buyer: { select: { username: true } }, store: { select: { storeName: true } } },
  });
  return orders.map((order) => ({
    id: order.id,
    buyerUsername: order.buyer.username,
    storeName: order.store.storeName,
    currentStatus: order.currentStatus,
    finalTotal: order.finalTotal,
    createdAt: order.createdAt,
  }));
}

export interface AdminDeliveryJobView {
  id: string;
  orderId: string;
  driverUsername: string | null;
  status: string;
  driverEarning: number;
  createdAt: Date;
}

/** Every delivery job, newest first, with the assigned driver's username (null if unassigned). */
export async function listDeliveryJobs(): Promise<AdminDeliveryJobView[]> {
  const jobs = await prisma.deliveryJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: { driver: { select: { username: true } } },
  });
  return jobs.map((job) => ({
    id: job.id,
    orderId: job.orderId,
    driverUsername: job.driver?.username ?? null,
    status: job.status,
    driverEarning: job.driverEarning,
    createdAt: job.createdAt,
  }));
}
