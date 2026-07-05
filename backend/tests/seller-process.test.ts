import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

const validStore = { storeName: 'Toko Proses', description: 'Toko uji proses order' };
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

async function createSellerWithProduct(username: string, storeName = validStore.storeName): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validStore, storeName });
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
  addressId: string;
}

async function createBuyerWithAddress(username: string): Promise<BuyerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  const addressRes = await request(app)
    .post('/api/buyer/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send(validAddress);
  const addressId = addressRes.body.address.id as string;
  return { token, addressId };
}

async function checkoutOneOrder(seller: SellerSetup, buyer: BuyerSetup): Promise<string> {
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
    .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });
  if (res.status !== 201) {
    throw new Error(`checkout failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.order.id as string;
}

describe('POST /api/seller/orders/:id/process', () => {
  it('owner seller can process SEDANG_DIKEMAS -> MENUNGGU_PENGIRIM with a history row', async () => {
    const seller = await createSellerWithProduct('process_owner_seller');
    const buyer = await createBuyerWithAddress('process_owner_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    const before = Date.now();
    const res = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${seller.token}`);
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.currentStatus).toBe('MENUNGGU_PENGIRIM');
    expect(res.body.order.statusHistory).toHaveLength(2);
    expect(res.body.order.statusHistory[0]).toMatchObject({ status: 'SEDANG_DIKEMAS', changedByRole: 'BUYER' });
    expect(res.body.order.statusHistory[1]).toMatchObject({ status: 'MENUNGGU_PENGIRIM', changedByRole: 'SELLER' });
    const changedAt = new Date(res.body.order.statusHistory[1].changedAt).getTime();
    expect(changedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(changedAt).toBeLessThanOrEqual(after + 1000);

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(persisted.currentStatus).toBe('MENUNGGU_PENGIRIM');
    const historyCount = await prisma.orderStatusHistory.count({ where: { orderId } });
    expect(historyCount).toBe(2);
  });

  it('processing the same order twice returns 409 INVALID_STATUS on the second call', async () => {
    const seller = await createSellerWithProduct('process_twice_seller');
    const buyer = await createBuyerWithAddress('process_twice_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    const first = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${seller.token}`);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_STATUS');

    // Still exactly one SELLER history row -- the second call wrote nothing.
    const historyCount = await prisma.orderStatusHistory.count({
      where: { orderId, changedByRole: 'SELLER' },
    });
    expect(historyCount).toBe(1);
  });

  it('returns 404 ORDER_NOT_FOUND when a different seller tries to process the order', async () => {
    const seller = await createSellerWithProduct('process_other_seller_a', 'Toko Alpha Proses');
    const otherSeller = await createSellerWithProduct('process_other_seller_b', 'Toko Beta Proses');
    const buyer = await createBuyerWithAddress('process_other_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    const res = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${otherSeller.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(persisted.currentStatus).toBe('SEDANG_DIKEMAS');
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const seller = await createSellerWithProduct('process_buyer_role_seller');
    const buyer = await createBuyerWithAddress('process_buyer_role_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    const res = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${buyer.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a driver-active-role user with 403 WRONG_ROLE', async () => {
    const seller = await createSellerWithProduct('process_driver_role_seller');
    const buyer = await createBuyerWithAddress('process_driver_role_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);

    const { token: driverToken } = await registerAndLogin(app, {
      roles: ['DRIVER'],
      username: 'process_driver_role_driver',
      activeRole: 'DRIVER',
    });

    const res = await request(app)
      .post(`/api/seller/orders/${orderId}/process`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});
