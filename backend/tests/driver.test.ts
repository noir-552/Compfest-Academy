import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

const validStore = { storeName: 'Toko Kirim', description: 'Toko uji driver' };
const validProduct = { name: 'Sepatu', description: 'Sepatu lari', price: 50000, stock: 10 };
const validAddress = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  phone: '081234567890',
  fullAddress: 'Jl. Merdeka No. 1, Jakarta',
};

interface SellerSetup {
  token: string;
  storeId: string;
  productId: string;
}

async function createSellerWithProduct(username: string, storeName?: string): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validStore, storeName: storeName ?? `${validStore.storeName} ${username}` });
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

async function checkoutOneOrder(
  seller: SellerSetup,
  buyer: BuyerSetup,
  deliveryMethod: 'REGULAR' | 'INSTANT' | 'NEXT_DAY' = 'REGULAR',
): Promise<string> {
  await request(app)
    .post('/api/buyer/cart/items')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ productId: seller.productId, quantity: 1 });
  await request(app)
    .post('/api/buyer/wallet/topup')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ amount: 1_000_000 });
  const res = await request(app)
    .post('/api/buyer/checkout')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ addressId: buyer.addressId, deliveryMethod });
  if (res.status !== 201) {
    throw new Error(`checkout failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.order.id as string;
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

describe('delivery job creation on processOrder', () => {
  it('creates an AVAILABLE delivery job in the same transaction as the status flip', async () => {
    const seller = await createSellerWithProduct('djob_seller');
    const buyer = await createBuyerWithAddress('djob_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    let job = await prisma.deliveryJob.findUnique({ where: { orderId } });
    expect(job).toBeNull();

    await processOrder(seller, orderId);

    job = await prisma.deliveryJob.findUnique({ where: { orderId } });
    expect(job).not.toBeNull();
    expect(job?.status).toBe('AVAILABLE');
    expect(job?.driverUserId).toBeNull();
  });
});

describe('GET /api/driver/jobs/available', () => {
  it('lists only AVAILABLE jobs, never unprocessed (SEDANG_DIKEMAS) orders', async () => {
    const seller = await createSellerWithProduct('djavail_seller');
    const buyer = await createBuyerWithAddress('djavail_buyer');

    // Unprocessed order: no job row created at all.
    const unprocessedOrderId = await checkoutOneOrder(seller, buyer);
    let jobForUnprocessed = await prisma.deliveryJob.findUnique({ where: { orderId: unprocessedOrderId } });
    expect(jobForUnprocessed).toBeNull();

    // Processed order: AVAILABLE job, should show up.
    const availableOrderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, availableOrderId);

    const token = await driverToken('djavail_driver');
    const res = await request(app).get('/api/driver/jobs/available').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].order.id).toBe(availableOrderId);
    expect(res.body.jobs[0].order.storeName).toBeTruthy();
    expect(res.body.jobs[0].order.itemCount).toBe(1);

    jobForUnprocessed = await prisma.deliveryJob.findUnique({ where: { orderId: unprocessedOrderId } });
    expect(jobForUnprocessed).toBeNull();
  });

  it('excludes TAKEN/COMPLETED jobs from the available list', async () => {
    const seller = await createSellerWithProduct('djavail2_seller');
    const buyer = await createBuyerWithAddress('djavail2_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);

    const driver1 = await driverToken('djavail2_driver1');
    const jobsRes = await request(app).get('/api/driver/jobs/available').set('Authorization', `Bearer ${driver1}`);
    const jobId = jobsRes.body.jobs[0].id as string;

    await request(app).post(`/api/driver/jobs/${jobId}/take`).set('Authorization', `Bearer ${driver1}`);

    const afterTake = await request(app)
      .get('/api/driver/jobs/available')
      .set('Authorization', `Bearer ${driver1}`);
    expect(afterTake.body.jobs).toHaveLength(0);

    await request(app).post(`/api/driver/jobs/${jobId}/complete`).set('Authorization', `Bearer ${driver1}`);

    const afterComplete = await request(app)
      .get('/api/driver/jobs/available')
      .set('Authorization', `Bearer ${driver1}`);
    expect(afterComplete.body.jobs).toHaveLength(0);
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const buyer = await createBuyerWithAddress('djavail_wrongrole_buyer');
    const res = await request(app)
      .get('/api/driver/jobs/available')
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('POST /api/driver/jobs/:id/take', () => {
  it('happy path: job TAKEN, order SEDANG_DIKIRIM, history row appended', async () => {
    const seller = await createSellerWithProduct('djtake_seller');
    const buyer = await createBuyerWithAddress('djtake_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });
    const driver = await driverToken('djtake_driver');

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/take`)
      .set('Authorization', `Bearer ${driver}`);

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('TAKEN');
    expect(res.body.job.takenAt).toBeTruthy();

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('TAKEN');
    expect(persistedJob.driverUserId).not.toBeNull();

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(persistedOrder.currentStatus).toBe('SEDANG_DIKIRIM');

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { changedAt: 'asc' } });
    expect(history.map((h) => h.status)).toEqual(['SEDANG_DIKEMAS', 'MENUNGGU_PENGIRIM', 'SEDANG_DIKIRIM']);
    expect(history[2].changedByRole).toBe('DRIVER');
  });

  it('second driver taking the same job gets 409 JOB_ALREADY_TAKEN', async () => {
    const seller = await createSellerWithProduct('djtake2_seller');
    const buyer = await createBuyerWithAddress('djtake2_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });
    const driver1 = await driverToken('djtake2_driver1');
    const driver2 = await driverToken('djtake2_driver2');

    const first = await request(app)
      .post(`/api/driver/jobs/${job.id}/take`)
      .set('Authorization', `Bearer ${driver1}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/driver/jobs/${job.id}/take`)
      .set('Authorization', `Bearer ${driver2}`);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('JOB_ALREADY_TAKEN');
  });

  it('driver taking a job on their own purchase gets 403 SELF_DELIVERY_FORBIDDEN', async () => {
    const seller = await createSellerWithProduct('djself_seller');
    const { token, username } = await registerAndLogin(app, {
      roles: ['BUYER', 'DRIVER'],
      username: 'djself_both',
      activeRole: 'BUYER',
    });
    const addressRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    const addressId = addressRes.body.address.id as string;
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    const buyer: BuyerSetup = { token, userId: user.id, addressId };

    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const activeRoleRes = await request(app)
      .post('/api/auth/active-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'DRIVER' });
    expect(activeRoleRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/take`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_DELIVERY_FORBIDDEN');
  });

  it('driver with an active TAKEN job taking another gets 409 DRIVER_BUSY', async () => {
    const seller = await createSellerWithProduct('djbusy_seller');
    const buyer = await createBuyerWithAddress('djbusy_buyer');

    const orderId1 = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId1);
    const job1 = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: orderId1 } });

    const orderId2 = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId2);
    const job2 = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: orderId2 } });

    const driver = await driverToken('djbusy_driver');

    const first = await request(app)
      .post(`/api/driver/jobs/${job1.id}/take`)
      .set('Authorization', `Bearer ${driver}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/driver/jobs/${job2.id}/take`)
      .set('Authorization', `Bearer ${driver}`);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DRIVER_BUSY');
  });
});

describe('POST /api/driver/jobs/:id/complete', () => {
  it('happy path: order PESANAN_SELESAI, job COMPLETED, earning = floor(0.8*fee) for REGULAR', async () => {
    const seller = await createSellerWithProduct('djcomplete_seller');
    const buyer = await createBuyerWithAddress('djcomplete_buyer');
    const orderId = await checkoutOneOrder(seller, buyer, 'REGULAR');
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });
    const driver = await driverToken('djcomplete_driver');

    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driver}`);

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/complete`)
      .set('Authorization', `Bearer ${driver}`);

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('COMPLETED');
    expect(res.body.job.driverEarning).toBe(8000);
    expect(res.body.job.completedAt).toBeTruthy();

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(persistedOrder.currentStatus).toBe('PESANAN_SELESAI');

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { changedAt: 'asc' } });
    expect(history.map((h) => h.status)).toEqual([
      'SEDANG_DIKEMAS',
      'MENUNGGU_PENGIRIM',
      'SEDANG_DIKIRIM',
      'PESANAN_SELESAI',
    ]);
    expect(history[3].changedByRole).toBe('DRIVER');
  });

  it('completing another driver\'s job returns a 4xx and changes nothing', async () => {
    const seller = await createSellerWithProduct('djcomplete2_seller');
    const buyer = await createBuyerWithAddress('djcomplete2_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const driver1 = await driverToken('djcomplete2_driver1');
    const driver2 = await driverToken('djcomplete2_driver2');

    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driver1}`);

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/complete`)
      .set('Authorization', `Bearer ${driver2}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('TAKEN');
  });

  it('completing an AVAILABLE (untaken) job returns a 4xx', async () => {
    const seller = await createSellerWithProduct('djcomplete3_seller');
    const buyer = await createBuyerWithAddress('djcomplete3_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const driver = await driverToken('djcomplete3_driver');

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/complete`)
      .set('Authorization', `Bearer ${driver}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('AVAILABLE');
  });
});

describe('GET /api/driver/jobs/mine', () => {
  it('shows the active TAKEN job and COMPLETED history newest first', async () => {
    const seller = await createSellerWithProduct('djmine_seller');
    const buyer = await createBuyerWithAddress('djmine_buyer');
    const driver = await driverToken('djmine_driver');

    const orderId1 = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId1);
    const job1 = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: orderId1 } });
    await request(app).post(`/api/driver/jobs/${job1.id}/take`).set('Authorization', `Bearer ${driver}`);
    await request(app).post(`/api/driver/jobs/${job1.id}/complete`).set('Authorization', `Bearer ${driver}`);

    const orderId2 = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId2);
    const job2 = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: orderId2 } });
    await request(app).post(`/api/driver/jobs/${job2.id}/take`).set('Authorization', `Bearer ${driver}`);

    const res = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${driver}`);

    expect(res.status).toBe(200);
    expect(res.body.active.id).toBe(job2.id);
    expect(res.body.active.status).toBe('TAKEN');
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].id).toBe(job1.id);
    expect(res.body.history[0].status).toBe('COMPLETED');
  });

  it('returns null active job when the driver has no TAKEN job', async () => {
    const driver = await driverToken('djmine_empty_driver');
    const res = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${driver}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBeNull();
    expect(res.body.history).toEqual([]);
  });
});

describe('GET /api/driver/jobs/:id', () => {
  it('returns 404 JOB_NOT_FOUND for another driver\'s TAKEN job', async () => {
    const seller = await createSellerWithProduct('djdetail_seller');
    const buyer = await createBuyerWithAddress('djdetail_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const driver1 = await driverToken('djdetail_driver1');
    const driver2 = await driverToken('djdetail_driver2');
    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driver1}`);

    const res = await request(app)
      .get(`/api/driver/jobs/${job.id}`)
      .set('Authorization', `Bearer ${driver2}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('is visible to any driver while AVAILABLE, and to the owning driver once TAKEN', async () => {
    const seller = await createSellerWithProduct('djdetail2_seller');
    const buyer = await createBuyerWithAddress('djdetail2_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const driver1 = await driverToken('djdetail2_driver1');

    const beforeTake = await request(app)
      .get(`/api/driver/jobs/${job.id}`)
      .set('Authorization', `Bearer ${driver1}`);
    expect(beforeTake.status).toBe(200);
    expect(beforeTake.body.job.status).toBe('AVAILABLE');

    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driver1}`);

    const afterTake = await request(app)
      .get(`/api/driver/jobs/${job.id}`)
      .set('Authorization', `Bearer ${driver1}`);
    expect(afterTake.status).toBe(200);
    expect(afterTake.body.job.status).toBe('TAKEN');
  });
});

describe('GET /api/driver/earnings', () => {
  it('totals + count are exact after two completions across delivery methods', async () => {
    const seller = await createSellerWithProduct('djearn_seller');
    const buyer = await createBuyerWithAddress('djearn_buyer');
    const driver = await driverToken('djearn_driver');

    const regularOrderId = await checkoutOneOrder(seller, buyer, 'REGULAR');
    await processOrder(seller, regularOrderId);
    const regularJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: regularOrderId } });
    await request(app).post(`/api/driver/jobs/${regularJob.id}/take`).set('Authorization', `Bearer ${driver}`);
    await request(app).post(`/api/driver/jobs/${regularJob.id}/complete`).set('Authorization', `Bearer ${driver}`);

    const instantOrderId = await checkoutOneOrder(seller, buyer, 'INSTANT');
    await processOrder(seller, instantOrderId);
    const instantJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: instantOrderId } });
    await request(app).post(`/api/driver/jobs/${instantJob.id}/take`).set('Authorization', `Bearer ${driver}`);
    await request(app).post(`/api/driver/jobs/${instantJob.id}/complete`).set('Authorization', `Bearer ${driver}`);

    const res = await request(app).get('/api/driver/earnings').set('Authorization', `Bearer ${driver}`);

    expect(res.status).toBe(200);
    expect(res.body.completedCount).toBe(2);
    expect(res.body.totalEarnings).toBe(28000); // 8000 (REGULAR) + 20000 (INSTANT)
    expect(res.body.jobs).toHaveLength(2);
    const earningsByOrder = new Map(res.body.jobs.map((j: { orderId: string; driverEarning: number }) => [j.orderId, j.driverEarning]));
    expect(earningsByOrder.get(regularOrderId)).toBe(8000);
    expect(earningsByOrder.get(instantOrderId)).toBe(20000);
  });
});

describe('driver endpoint role enforcement', () => {
  it('rejects a buyer-active-role user hitting a driver endpoint with 403 WRONG_ROLE', async () => {
    const buyer = await createBuyerWithAddress('djrole_buyer');
    const res = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('order visibility of delivery statuses', () => {
  it('buyer and seller order detail show SEDANG_DIKIRIM and PESANAN_SELESAI with history', async () => {
    const seller = await createSellerWithProduct('djvis_seller');
    const buyer = await createBuyerWithAddress('djvis_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });
    const driver = await driverToken('djvis_driver');

    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driver}`);

    const buyerViewAfterTake = await request(app)
      .get(`/api/buyer/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(buyerViewAfterTake.body.order.currentStatus).toBe('SEDANG_DIKIRIM');

    await request(app).post(`/api/driver/jobs/${job.id}/complete`).set('Authorization', `Bearer ${driver}`);

    const sellerRes = await request(app)
      .get('/api/seller/orders')
      .set('Authorization', `Bearer ${seller.token}`);
    const sellerOrder = sellerRes.body.orders.find((o: { id: string }) => o.id === orderId);
    expect(sellerOrder.currentStatus).toBe('PESANAN_SELESAI');
    expect(sellerOrder.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'SEDANG_DIKEMAS',
      'MENUNGGU_PENGIRIM',
      'SEDANG_DIKIRIM',
      'PESANAN_SELESAI',
    ]);
  });
});
