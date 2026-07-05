import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { _setOffsetForTests } from '../src/lib/clock';
import { resetDb, registerAndLogin, registerAndLoginAdmin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  await _setOffsetForTests(0);
});

const validStore = { storeName: 'Toko Admin', description: 'Toko uji admin' };
const validProduct = { name: 'Sabun Mandi', description: 'Sabun batang', price: 15000, stock: 20 };
const validAddress = {
  label: 'Rumah',
  recipientName: 'Siti Aminah',
  phone: '081234567890',
  fullAddress: 'Jl. Kenanga No. 2, Bandung',
};

function futureIso(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

async function adminToken(username: string): Promise<string> {
  const { token } = await registerAndLoginAdmin(app, { username });
  return token;
}

interface SellerSetup {
  token: string;
  storeId: string;
  productId: string;
}

async function createSellerWithProduct(username: string): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validStore, storeName: `${validStore.storeName} ${username}` });
  const storeId = storeRes.body.store.id as string;

  const productRes = await request(app)
    .post('/api/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .send(validProduct);
  const productId = productRes.body.product.id as string;

  return { token, storeId, productId };
}

interface BuyerSetup {
  token: string;
  userId: string;
  addressId: string;
}

async function createBuyerWithAddress(username: string): Promise<BuyerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  const addressRes = await request(app)
    .post('/api/buyer/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send(validAddress);
  const addressId = addressRes.body.address.id as string;
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  return { token, userId: user.id, addressId };
}

async function topup(token: string, amount: number): Promise<void> {
  const res = await request(app)
    .post('/api/buyer/wallet/topup')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount });
  if (res.status !== 200) {
    throw new Error(`topup failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

async function addToCart(token: string, productId: string, quantity = 1): Promise<void> {
  const res = await request(app)
    .post('/api/buyer/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
  if (res.status !== 200) {
    throw new Error(`addToCart failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

interface CheckedOutOrder {
  id: string;
  finalTotal: number;
}

async function checkout(buyer: BuyerSetup, deliveryMethod: 'REGULAR' | 'INSTANT' | 'NEXT_DAY'): Promise<CheckedOutOrder> {
  const res = await request(app)
    .post('/api/buyer/checkout')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ addressId: buyer.addressId, deliveryMethod });
  if (res.status !== 201) {
    throw new Error(`checkout failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.order as CheckedOutOrder;
}

async function processOrder(seller: SellerSetup, orderId: string): Promise<void> {
  const res = await request(app)
    .post(`/api/seller/orders/${orderId}/process`)
    .set('Authorization', `Bearer ${seller.token}`);
  if (res.status !== 200) {
    throw new Error(`process failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

async function driverToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['DRIVER'], username, activeRole: 'DRIVER' });
  return token;
}

function takeJob(driver: string, jobId: string) {
  return request(app).post(`/api/driver/jobs/${jobId}/take`).set('Authorization', `Bearer ${driver}`);
}

describe('admin monitoring: role guard', () => {
  it('rejects a non-admin (active buyer) with 403 on overview', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'], username: 'guard_overview_buyer' });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a non-admin (active buyer) with 403 on users list', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'], username: 'guard_users_buyer' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated caller with 401 on overview', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/overview', () => {
  it('reports exact seeded counts across users/stores/products/orders/vouchers/promos/jobs', async () => {
    const admin = await adminToken('overview_admin');
    const seller = await createSellerWithProduct('overview_seller');
    const buyer = await createBuyerWithAddress('overview_buyer');

    await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'OVW10', discountType: 'PERCENT', discountValue: 10, usageLimit: 5, expiryDate: futureIso() });
    await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'OVWPROMO', discountType: 'FIXED', discountValue: 5000, expiryDate: futureIso() });

    await topup(buyer.token, 1_000_000);

    // Order 1: stays unprocessed at SEDANG_DIKEMAS, no delivery job created yet.
    await addToCart(buyer.token, seller.productId, 1);
    await checkout(buyer, 'REGULAR');

    // Order 2: processed (creates an AVAILABLE job) then taken by a driver
    // (job -> TAKEN, order -> SEDANG_DIKIRIM).
    await addToCart(buyer.token, seller.productId, 1);
    const order2 = await checkout(buyer, 'INSTANT');
    await processOrder(seller, order2.id);
    const job2 = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order2.id } });
    const driver = await driverToken('overview_driver');
    const takeRes = await takeJob(driver, job2.id);
    expect(takeRes.status).toBe(200);

    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.virtualDate).toBeTruthy();

    // 4 users: admin, seller, buyer, driver.
    expect(res.body.counts.users).toBe(4);
    expect(res.body.counts.stores).toBe(1);
    expect(res.body.counts.products).toBe(1);
    expect(res.body.counts.vouchers).toBe(1);
    expect(res.body.counts.promos).toBe(1);
    expect(res.body.counts.overduePending).toBe(0);

    expect(res.body.counts.ordersByStatus).toEqual({
      SEDANG_DIKEMAS: 1,
      MENUNGGU_PENGIRIM: 0,
      SEDANG_DIKIRIM: 1,
      PESANAN_SELESAI: 0,
      DIKEMBALIKAN: 0,
    });

    expect(res.body.counts.jobsByStatus).toEqual({
      AVAILABLE: 0,
      TAKEN: 1,
      COMPLETED: 0,
      CANCELLED: 0,
    });
  });
});

describe('GET /api/admin/users', () => {
  it('lists users with roles and never leaks passwordHash', async () => {
    const admin = await adminToken('users_admin');
    await registerAndLogin(app, { roles: ['BUYER'], username: 'users_buyer' });

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBe(2);

    for (const user of res.body.users as Record<string, unknown>[]) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.username).toBeTruthy();
      expect(user.email).toBeTruthy();
      expect(user.phone).toBeTruthy();
      expect(Array.isArray(user.roles)).toBe(true);
      expect(user.createdAt).toBeTruthy();
    }

    const buyerEntry = (res.body.users as { username: string; roles: string[] }[]).find(
      (u) => u.username === 'users_buyer',
    );
    expect(buyerEntry?.roles).toEqual(['BUYER']);
  });
});

describe('GET /api/admin/stores', () => {
  it('lists stores with seller username and product count', async () => {
    const admin = await adminToken('stores_admin');
    const seller = await createSellerWithProduct('stores_seller');

    const res = await request(app).get('/api/admin/stores').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const entry = (res.body.stores as { id: string; sellerUsername: string; productCount: number }[]).find(
      (s) => s.id === seller.storeId,
    );
    expect(entry?.sellerUsername).toBe('stores_seller');
    expect(entry?.productCount).toBe(1);
  });
});

describe('GET /api/admin/products', () => {
  it('lists products with store name and isDeleted flag', async () => {
    const admin = await adminToken('products_admin');
    const seller = await createSellerWithProduct('products_seller');
    await request(app)
      .delete(`/api/seller/products/${seller.productId}`)
      .set('Authorization', `Bearer ${seller.token}`);

    const res = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const entry = (res.body.products as { id: string; storeName: string; isDeleted: boolean }[]).find(
      (p) => p.id === seller.productId,
    );
    expect(entry?.storeName).toContain('Toko Admin');
    expect(entry?.isDeleted).toBe(true);
  });
});

describe('GET /api/admin/orders', () => {
  it('lists orders newest first with buyer username, store name, status, and final total', async () => {
    const admin = await adminToken('orders_admin');
    const seller = await createSellerWithProduct('orders_seller');
    const buyer = await createBuyerWithAddress('orders_buyer');
    await topup(buyer.token, 1_000_000);

    await addToCart(buyer.token, seller.productId, 1);
    const order1 = await checkout(buyer, 'REGULAR');
    await addToCart(buyer.token, seller.productId, 1);
    const order2 = await checkout(buyer, 'INSTANT');

    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const orders = res.body.orders as { id: string; buyerUsername: string; storeName: string; currentStatus: string; finalTotal: number }[];

    // Newest first: order2 was created after order1.
    const idx1 = orders.findIndex((o) => o.id === order1.id);
    const idx2 = orders.findIndex((o) => o.id === order2.id);
    expect(idx2).toBeLessThan(idx1);

    const entry1 = orders.find((o) => o.id === order1.id);
    expect(entry1?.buyerUsername).toBe('orders_buyer');
    expect(entry1?.storeName).toContain('Toko Admin');
    expect(entry1?.currentStatus).toBe('SEDANG_DIKEMAS');
    expect(entry1?.finalTotal).toBe(order1.finalTotal);
  });
});

describe('GET /api/admin/delivery-jobs', () => {
  it('lists delivery jobs with order id, driver username, status, and earning', async () => {
    const admin = await adminToken('jobs_admin');
    const seller = await createSellerWithProduct('jobs_seller');
    const buyer = await createBuyerWithAddress('jobs_buyer');
    await topup(buyer.token, 1_000_000);
    await addToCart(buyer.token, seller.productId, 1);
    const order = await checkout(buyer, 'INSTANT');
    await processOrder(seller, order.id);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });
    const driver = await driverToken('jobs_driver');
    await takeJob(driver, job.id);

    const res = await request(app).get('/api/admin/delivery-jobs').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const entry = (
      res.body.jobs as { id: string; orderId: string; driverUsername: string | null; status: string; driverEarning: number }[]
    ).find((j) => j.id === job.id);
    expect(entry?.orderId).toBe(order.id);
    expect(entry?.driverUsername).toBe('jobs_driver');
    expect(entry?.status).toBe('TAKEN');
    expect(typeof entry?.driverEarning).toBe('number');
  });
});
