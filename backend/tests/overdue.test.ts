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

const validStore = { storeName: 'Toko Overdue', description: 'Toko uji overdue' };
const validProduct = { name: 'Kipas Angin', description: 'Kipas angin mini', price: 100000, stock: 10 };
const validAddress = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  phone: '081234567890',
  fullAddress: 'Jl. Merdeka No. 1, Jakarta',
};

function futureIso(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
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
  ppnAmount: number;
  deliveryFee: number;
}

async function checkout(
  buyer: BuyerSetup,
  deliveryMethod: 'REGULAR' | 'INSTANT' | 'NEXT_DAY',
  voucherCode?: string,
): Promise<CheckedOutOrder> {
  const res = await request(app)
    .post('/api/buyer/checkout')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ addressId: buyer.addressId, deliveryMethod, ...(voucherCode ? { voucherCode } : {}) });
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

function completeJob(driver: string, jobId: string) {
  return request(app).post(`/api/driver/jobs/${jobId}/complete`).set('Authorization', `Bearer ${driver}`);
}

async function adminToken(username: string): Promise<string> {
  const { token } = await registerAndLoginAdmin(app, { username });
  return token;
}

function simulateNextDay(admin: string) {
  return request(app).post('/api/admin/simulate-next-day').set('Authorization', `Bearer ${admin}`);
}

describe('POST /api/admin/simulate-next-day', () => {
  it('advances the virtual date by exactly 1 day per call', async () => {
    const admin = await adminToken('sim_admin');

    const first = await simulateNextDay(admin);
    expect(first.status).toBe(200);
    const firstDate = new Date(first.body.virtualDate as string);

    const second = await simulateNextDay(admin);
    expect(second.status).toBe(200);
    const secondDate = new Date(second.body.virtualDate as string);

    // Exactly 1 day apart, plus whatever small amount of real wall-clock
    // time elapsed between the two requests (both calls read Date.now()
    // internally, so a few ms of test-runtime drift is expected and fine).
    const diff = secondDate.getTime() - firstDate.getTime();
    expect(diff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 2000);
    expect(Array.isArray(second.body.processed)).toBe(true);
  });

  it('rejects a non-admin caller with 403', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'], username: 'sim_buyer' });
    const res = await request(app)
      .post('/api/admin/simulate-next-day')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('overdue sweep: INSTANT order left unprocessed', () => {
  it('returns the order, refunds the wallet, restores stock+voucher quota, and leaves an audit trail', async () => {
    const admin = await adminToken('instant_admin');
    const voucherRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'OVERDUE10', discountType: 'PERCENT', discountValue: 10, usageLimit: 5, expiryDate: futureIso() });
    expect(voucherRes.status).toBe(201);

    const seller = await createSellerWithProduct('instant_seller');
    const buyer = await createBuyerWithAddress('instant_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);

    const walletBeforeCheckout = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);
    const balanceBeforeCheckout = walletBeforeCheckout.body.wallet.balance as number;

    const order = await checkout(buyer, 'INSTANT', 'OVERDUE10');

    const productBeforeSweep = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    const voucherBeforeSweep = await prisma.voucher.findUniqueOrThrow({ where: { code: 'OVERDUE10' } });
    const walletAfterCheckout = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);
    const balanceAfterCheckout = walletAfterCheckout.body.wallet.balance as number;
    expect(balanceAfterCheckout).toBe(balanceBeforeCheckout - order.finalTotal);

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persistedOrder.currentStatus).toBe('DIKEMBALIKAN');
    expect(persistedOrder.isRefunded).toBe(true);
    expect(persistedOrder.isStockRestored).toBe(true);
    expect(persistedOrder.isVoucherRestored).toBe(true);

    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(balanceAfterCheckout + order.finalTotal);

    const refundTx = (
      walletRes.body.transactions as { type: string; orderId: string | null; amount: number }[]
    ).find((t) => t.type === 'REFUND' && t.orderId === order.id);
    expect(refundTx).toBeTruthy();
    expect(refundTx?.amount).toBe(order.finalTotal);

    const productAfterSweep = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(productAfterSweep.stock).toBe(productBeforeSweep.stock + 1);

    const voucherAfterSweep = await prisma.voucher.findUniqueOrThrow({ where: { code: 'OVERDUE10' } });
    expect(voucherAfterSweep.usageRemaining).toBe(voucherBeforeSweep.usageRemaining + 1);

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { changedAt: 'asc' },
    });
    const systemRow = history.find((h) => h.changedByRole === 'SYSTEM');
    expect(systemRow).toBeTruthy();
    expect(systemRow?.status).toBe('DIKEMBALIKAN');

    const buyerDetail = await request(app)
      .get(`/api/buyer/orders/${order.id}`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(buyerDetail.body.order.currentStatus).toBe('DIKEMBALIKAN');
  });

  it('idempotency proof: sweeping twice more never double-refunds/restocks/re-credits', async () => {
    const admin = await adminToken('idem_admin');
    const voucherRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'IDEM10', discountType: 'PERCENT', discountValue: 10, usageLimit: 5, expiryDate: futureIso() });
    expect(voucherRes.status).toBe(201);

    const seller = await createSellerWithProduct('idem_seller');
    const buyer = await createBuyerWithAddress('idem_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'INSTANT', 'IDEM10');

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const walletAfterFirstSweep = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);
    const balanceAfterFirstSweep = walletAfterFirstSweep.body.wallet.balance as number;
    const refundCountAfterFirstSweep = (
      walletAfterFirstSweep.body.transactions as { type: string }[]
    ).filter((t) => t.type === 'REFUND').length;
    const productAfterFirstSweep = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    const voucherAfterFirstSweep = await prisma.voucher.findUniqueOrThrow({ where: { code: 'IDEM10' } });
    const historyCountAfterFirstSweep = await prisma.orderStatusHistory.count({ where: { orderId: order.id } });

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const walletAfterMoreSweeps = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(walletAfterMoreSweeps.body.wallet.balance).toBe(balanceAfterFirstSweep);
    const refundCountAfterMoreSweeps = (
      walletAfterMoreSweeps.body.transactions as { type: string }[]
    ).filter((t) => t.type === 'REFUND').length;
    expect(refundCountAfterMoreSweeps).toBe(refundCountAfterFirstSweep);

    const productAfterMoreSweeps = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(productAfterMoreSweeps.stock).toBe(productAfterFirstSweep.stock);

    const voucherAfterMoreSweeps = await prisma.voucher.findUniqueOrThrow({ where: { code: 'IDEM10' } });
    expect(voucherAfterMoreSweeps.usageRemaining).toBe(voucherAfterFirstSweep.usageRemaining);

    const historyCountAfterMoreSweeps = await prisma.orderStatusHistory.count({ where: { orderId: order.id } });
    expect(historyCountAfterMoreSweeps).toBe(historyCountAfterFirstSweep);
  });
});

describe('overdue sweep: SEDANG_DIKIRIM order past SLA', () => {
  it('returns the order and cancels the TAKEN job with zero earning, excluded from driver earnings', async () => {
    const admin = await adminToken('transit_admin');
    const seller = await createSellerWithProduct('transit_seller');
    const buyer = await createBuyerWithAddress('transit_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'INSTANT');
    await processOrder(seller, order.id);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });
    const driver = await driverToken('transit_driver');
    const takeRes = await takeJob(driver, job.id);
    expect(takeRes.status).toBe(200);

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persistedOrder.currentStatus).toBe('DIKEMBALIKAN');

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('CANCELLED');
    expect(persistedJob.driverEarning).toBe(0);

    const earningsRes = await request(app).get('/api/driver/earnings').set('Authorization', `Bearer ${driver}`);
    expect(earningsRes.body.completedCount).toBe(0);
    expect(earningsRes.body.totalEarnings).toBe(0);
    expect(
      (earningsRes.body.jobs as { orderId: string }[]).find((j) => j.orderId === order.id),
    ).toBeUndefined();
  });
});

describe('overdue sweep: orders that should NOT be touched', () => {
  it('leaves a PESANAN_SELESAI order untouched even past its deadline', async () => {
    const admin = await adminToken('done_admin');
    const seller = await createSellerWithProduct('done_seller');
    const buyer = await createBuyerWithAddress('done_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'INSTANT');
    await processOrder(seller, order.id);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });
    const driver = await driverToken('done_driver');
    await takeJob(driver, job.id);
    const completeRes = await completeJob(driver, job.id);
    expect(completeRes.status).toBe(200);

    const productBefore = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    const walletBefore = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persistedOrder.currentStatus).toBe('PESANAN_SELESAI');
    expect(persistedOrder.isRefunded).toBe(false);

    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(productAfter.stock).toBe(productBefore.stock);

    const walletAfter = await request(app)
      .get('/api/buyer/wallet')
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(walletAfter.body.wallet.balance).toBe(walletBefore.body.wallet.balance);

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(persistedJob.status).toBe('COMPLETED');
  });

  it('leaves a REGULAR order (SLA +4d) untouched after only 2 simulated days', async () => {
    const admin = await adminToken('regular_admin');
    const seller = await createSellerWithProduct('regular_seller');
    const buyer = await createBuyerWithAddress('regular_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'REGULAR');

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persistedOrder.currentStatus).toBe('SEDANG_DIKEMAS');
    expect(persistedOrder.isRefunded).toBe(false);
  });
});

describe('seller income report reflects overdue refunds', () => {
  it('drops the refunded order from income with exact before/after values', async () => {
    const admin = await adminToken('income_admin');
    const seller = await createSellerWithProduct('income_seller');
    const buyer = await createBuyerWithAddress('income_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'INSTANT');

    const reportBefore = await request(app)
      .get('/api/seller/report')
      .set('Authorization', `Bearer ${seller.token}`);
    const expectedIncomeContribution = order.finalTotal - order.ppnAmount - order.deliveryFee;
    expect(reportBefore.body.income).toBe(expectedIncomeContribution);

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const reportAfter = await request(app)
      .get('/api/seller/report')
      .set('Authorization', `Bearer ${seller.token}`);
    expect(reportAfter.body.income).toBe(reportBefore.body.income - expectedIncomeContribution);
    expect(reportAfter.body.income).toBe(0);
  });
});

describe('carry-over: take/complete guard against order flipped concurrently', () => {
  it('take returns 409 INVALID_STATUS when the order was returned concurrently, and rolls back the job', async () => {
    const seller = await createSellerWithProduct('concurrent_take_seller');
    const buyer = await createBuyerWithAddress('concurrent_take_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'REGULAR');
    await processOrder(seller, order.id);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });

    // Simulate the sweep having flipped this order concurrently (without
    // touching the job row, exactly as a race would leave things).
    await prisma.order.update({ where: { id: order.id }, data: { currentStatus: 'DIKEMBALIKAN' } });

    const driver = await driverToken('concurrent_take_driver');
    const res = await takeJob(driver, job.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS');

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('AVAILABLE');
    expect(persistedJob.driverUserId).toBeNull();
  });

  it('complete returns 409 INVALID_STATUS when the order was returned concurrently, and rolls back the job', async () => {
    const seller = await createSellerWithProduct('concurrent_complete_seller');
    const buyer = await createBuyerWithAddress('concurrent_complete_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'REGULAR');
    await processOrder(seller, order.id);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId: order.id } });
    const driver = await driverToken('concurrent_complete_driver');
    const takeRes = await takeJob(driver, job.id);
    expect(takeRes.status).toBe(200);

    // Simulate the sweep having flipped this order concurrently while the
    // job stays TAKEN.
    await prisma.order.update({ where: { id: order.id }, data: { currentStatus: 'DIKEMBALIKAN' } });

    const res = await completeJob(driver, job.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS');

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('TAKEN');
  });
});

describe('history rows written by the sweep carry virtual-time changedAt', () => {
  it('the SYSTEM history row is dated at the virtual now, days ahead of the real wall clock', async () => {
    const admin = await adminToken('vt_admin');
    const seller = await createSellerWithProduct('vt_seller');
    const buyer = await createBuyerWithAddress('vt_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const order = await checkout(buyer, 'INSTANT');

    const first = await simulateNextDay(admin);
    const second = await simulateNextDay(admin);
    expect(first.status).toBe(200);

    // The sweep is idempotent-by-status, so the order may already flip to
    // DIKEMBALIKAN on the first call (if enough real wall-clock time has
    // elapsed since checkout) rather than strictly waiting for the second —
    // pin the comparison to whichever call's `processed` list actually
    // contains this order, not to a fixed call index.
    const processedFirst = (first.body.processed as { orderId: string }[]).some((p) => p.orderId === order.id);
    const sweepResponse = processedFirst ? first : second;
    const virtualDate = new Date(sweepResponse.body.virtualDate as string);

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { changedAt: 'asc' },
    });
    const systemRow = history.find((h) => h.changedByRole === 'SYSTEM');
    expect(systemRow).toBeTruthy();

    const changedAt = systemRow!.changedAt.getTime();
    // Within a few seconds of the virtual "now" the sweep ran at...
    expect(Math.abs(changedAt - virtualDate.getTime())).toBeLessThan(5000);
    // ...and clearly NOT the real wall-clock time (it's at least ~20 hours
    // ahead, whether the sweep fired on the 1-day or 2-day advance).
    expect(changedAt - Date.now()).toBeGreaterThan(20 * 60 * 60 * 1000);
  });
});

describe('GET /api/admin/overdue', () => {
  it('lists pending overdue orders and already-returned orders with buyer/store info', async () => {
    const admin = await adminToken('list_admin');
    const seller = await createSellerWithProduct('list_seller');
    const buyer = await createBuyerWithAddress('list_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);
    const instantOrder = await checkout(buyer, 'INSTANT');

    await addToCart(buyer.token, seller.productId, 1);
    const regularOrder = await checkout(buyer, 'REGULAR');

    await simulateNextDay(admin);
    await simulateNextDay(admin);

    const res = await request(app).get('/api/admin/overdue').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);

    const returnedIds = (res.body.returned as { id: string }[]).map((o) => o.id);
    expect(returnedIds).toContain(instantOrder.id);
    expect(returnedIds).not.toContain(regularOrder.id);

    const pendingIds = (res.body.pending as { id: string }[]).map((o) => o.id);
    expect(pendingIds).not.toContain(instantOrder.id);
    expect(pendingIds).not.toContain(regularOrder.id);

    const returnedEntry = (res.body.returned as { id: string; buyerUsername: string; storeName: string }[]).find(
      (o) => o.id === instantOrder.id,
    );
    expect(returnedEntry?.buyerUsername).toBeTruthy();
    expect(returnedEntry?.storeName).toBeTruthy();
  });
});
