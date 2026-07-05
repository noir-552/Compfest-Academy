import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

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

async function createSellerWithProduct(
  username: string,
  storeName: string,
  price: number,
): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ storeName, description: 'Toko uji laporan' });
  const storeId = storeRes.body.store.id as string;

  const productRes = await request(app)
    .post('/api/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Barang', description: 'Barang uji', price, stock: 100 });
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

async function checkout(
  seller: SellerSetup,
  buyer: BuyerSetup,
  deliveryMethod: 'REGULAR' | 'INSTANT' | 'NEXT_DAY',
): Promise<{ id: string; finalTotal: number }> {
  await request(app)
    .post('/api/buyer/cart/items')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ productId: seller.productId, quantity: 1 });
  const res = await request(app)
    .post('/api/buyer/checkout')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ addressId: buyer.addressId, deliveryMethod });
  if (res.status !== 201) {
    throw new Error(`checkout failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.order.id as string, finalTotal: res.body.order.finalTotal as number };
}

// price 50000, REGULAR fee 10000: subtotal 50000, ppn floor(0.12*50000)=6000, final=66000
// price 50000, INSTANT fee 25000: subtotal 50000, ppn 6000, final=81000
// price 20000, REGULAR fee 10000: subtotal 20000, ppn floor(0.12*20000)=2400, final=32400

describe('GET /api/buyer/report', () => {
  it('sums finalTotal + counts + byStatus over the buyer\'s own orders', async () => {
    const seller = await createSellerWithProduct('report_buyer_seller', 'Toko Laporan Pembeli', 50000);
    const buyer = await createBuyerWithAddress('report_buyer_buyer');
    await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ amount: 1_000_000 });

    const first = await checkout(seller, buyer, 'REGULAR'); // final 66000
    const second = await checkout(seller, buyer, 'INSTANT'); // final 81000

    // Move the second order forward so byStatus has two distinct buckets.
    await request(app)
      .post(`/api/seller/orders/${second.id}/process`)
      .set('Authorization', `Bearer ${seller.token}`);

    const res = await request(app).get('/api/buyer/report').set('Authorization', `Bearer ${buyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalSpent).toBe(first.finalTotal + second.finalTotal);
    expect(res.body.totalSpent).toBe(147000);
    expect(res.body.orderCount).toBe(2);
    expect(res.body.byStatus).toEqual({ SEDANG_DIKEMAS: 1, MENUNGGU_PENGIRIM: 1 });
  });

  it("does not leak another buyer's spending", async () => {
    const seller = await createSellerWithProduct('report_leak_seller', 'Toko Laporan Leak', 50000);
    const buyerA = await createBuyerWithAddress('report_leak_buyer_a');
    const buyerB = await createBuyerWithAddress('report_leak_buyer_b');
    await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({ amount: 1_000_000 });

    await checkout(seller, buyerA, 'REGULAR');

    const res = await request(app).get('/api/buyer/report').set('Authorization', `Bearer ${buyerB.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalSpent).toBe(0);
    expect(res.body.orderCount).toBe(0);
    expect(res.body.byStatus).toEqual({});
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });
    const res = await request(app).get('/api/buyer/report').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('GET /api/seller/report', () => {
  it('sums (finalTotal - ppnAmount - deliveryFee) + counts + byStatus over the store\'s orders', async () => {
    const seller = await createSellerWithProduct('report_seller_seller', 'Toko Laporan Penjual', 50000);
    const buyer = await createBuyerWithAddress('report_seller_buyer');
    await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ amount: 1_000_000 });

    await checkout(seller, buyer, 'REGULAR'); // subtotal 50000 recognized
    const second = await checkout(seller, buyer, 'INSTANT'); // subtotal 50000 recognized

    await request(app)
      .post(`/api/seller/orders/${second.id}/process`)
      .set('Authorization', `Bearer ${seller.token}`);

    const res = await request(app).get('/api/seller/report').set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toBe(100000); // 50000 + 50000, excludes ppn/fee
    expect(res.body.orderCount).toBe(2);
    expect(res.body.byStatus).toEqual({ SEDANG_DIKEMAS: 1, MENUNGGU_PENGIRIM: 1 });
  });

  it("does not leak a second seller's income into the first seller's report", async () => {
    const sellerA = await createSellerWithProduct('report_seller_leak_a', 'Toko Leak A', 50000);
    const sellerB = await createSellerWithProduct('report_seller_leak_b', 'Toko Leak B', 20000);
    const buyer = await createBuyerWithAddress('report_seller_leak_buyer');
    await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ amount: 1_000_000 });

    await checkout(sellerA, buyer, 'REGULAR'); // sellerA subtotal 50000
    await checkout(sellerB, buyer, 'REGULAR'); // sellerB subtotal 20000

    const resA = await request(app).get('/api/seller/report').set('Authorization', `Bearer ${sellerA.token}`);
    const resB = await request(app).get('/api/seller/report').set('Authorization', `Bearer ${sellerB.token}`);

    expect(resA.body.income).toBe(50000);
    expect(resA.body.orderCount).toBe(1);
    expect(resB.body.income).toBe(20000);
    expect(resB.body.orderCount).toBe(1);
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'], activeRole: 'BUYER' });
    const res = await request(app).get('/api/seller/report').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});
