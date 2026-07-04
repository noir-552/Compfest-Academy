import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { resetDb, registerAndLogin, registerAndLoginAdmin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

const validStore = {
  storeName: 'Toko Diskon',
  description: 'Jual barang diskon',
};

// Priced so subtotal lands exactly on 100000 with qty 1, matching the brief's
// worked example: voucher PERCENT 10 -> 10000, promo FIXED 5000 -> total
// discount 15000, ppn floor(0.12*85000)=10200, REGULAR fee 10000, final 105200.
const validProduct = {
  name: 'Kursi Kantor',
  description: 'Kursi kantor ergonomis',
  price: 100000,
  stock: 10,
};

const validAddress = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  phone: '081234567890',
  fullAddress: 'Jl. Merdeka No. 1, Jakarta',
};

const SUBTOTAL = 100000;
const VOUCHER_AMOUNT = 10000; // PERCENT 10 of 100000
const PROMO_AMOUNT = 5000; // FIXED 5000
const DISCOUNT_TOTAL = VOUCHER_AMOUNT + PROMO_AMOUNT;
const PPN = 10200; // floor(0.12 * (100000 - 15000))
const DELIVERY_FEE = 10000; // REGULAR
const FINAL_TOTAL = 100000 - DISCOUNT_TOTAL + PPN + DELIVERY_FEE; // 105200

function futureIso(daysAhead = 7): string {
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
    .send(validStore);
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

async function addToCart(token: string, productId: string, quantity: number): Promise<void> {
  const res = await request(app)
    .post('/api/buyer/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
  if (res.status !== 200) {
    throw new Error(`addToCart failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
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

async function adminToken(username: string): Promise<string> {
  const { token } = await registerAndLoginAdmin(app, { username });
  return token;
}

async function createVoucher(
  admin: string,
  overrides: Partial<{ code: string; discountType: string; discountValue: number; usageLimit: number; expiryDate: string }> = {},
): Promise<string> {
  const res = await request(app)
    .post('/api/admin/vouchers')
    .set('Authorization', `Bearer ${admin}`)
    .send({
      code: 'VOUCH10',
      discountType: 'PERCENT',
      discountValue: 10,
      usageLimit: 5,
      expiryDate: futureIso(),
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createVoucher failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.voucher.id as string;
}

async function createPromo(
  admin: string,
  overrides: Partial<{ code: string; discountType: string; discountValue: number; expiryDate: string }> = {},
): Promise<string> {
  const res = await request(app)
    .post('/api/admin/promos')
    .set('Authorization', `Bearer ${admin}`)
    .send({
      code: 'PROMO5K',
      discountType: 'FIXED',
      discountValue: 5000,
      expiryDate: futureIso(),
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createPromo failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.promo.id as string;
}

describe('POST /api/buyer/checkout/preview with discounts', () => {
  it('returns discounted totals + per-code breakdown without writing anything', async () => {
    const admin = await adminToken('preview_disc_admin');
    await createVoucher(admin);
    await createPromo(admin);

    const seller = await createSellerWithProduct('preview_disc_seller');
    const buyer = await createBuyerWithAddress('preview_disc_buyer');
    await addToCart(buyer.token, seller.productId, 1);

    const res = await request(app)
      .post('/api/buyer/checkout/preview')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        addressId: buyer.addressId,
        deliveryMethod: 'REGULAR',
        voucherCode: 'VOUCH10',
        promoCode: 'PROMO5K',
      });

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      subtotal: SUBTOTAL,
      discountAmount: DISCOUNT_TOTAL,
      deliveryFee: DELIVERY_FEE,
      ppnAmount: PPN,
      finalTotal: FINAL_TOTAL,
    });
    expect(res.body.discounts).toEqual({
      voucher: { code: 'VOUCH10', amount: VOUCHER_AMOUNT },
      promo: { code: 'PROMO5K', amount: PROMO_AMOUNT },
    });

    // Preview never writes: quota untouched, no orders.
    const voucher = await prisma.voucher.findUniqueOrThrow({ where: { code: 'VOUCH10' } });
    expect(voucher.usageRemaining).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('POST /api/buyer/checkout with discounts', () => {
  it('commits with voucher+promo: exact totals, persisted voucherId/promoId/discountAmount, wallet debited discounted total', async () => {
    const admin = await adminToken('checkout_disc_admin');
    await createVoucher(admin);
    await createPromo(admin);

    const seller = await createSellerWithProduct('checkout_disc_seller');
    const buyer = await createBuyerWithAddress('checkout_disc_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 200000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        addressId: buyer.addressId,
        deliveryMethod: 'REGULAR',
        voucherCode: 'VOUCH10',
        promoCode: 'PROMO5K',
      });

    expect(res.status).toBe(201);
    const order = res.body.order;
    expect(order.subtotal).toBe(SUBTOTAL);
    expect(order.discountAmount).toBe(DISCOUNT_TOTAL);
    expect(order.deliveryFee).toBe(DELIVERY_FEE);
    expect(order.ppnAmount).toBe(PPN);
    expect(order.finalTotal).toBe(FINAL_TOTAL);

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persisted.voucherId).not.toBeNull();
    expect(persisted.promoId).not.toBeNull();
    expect(persisted.discountAmount).toBe(DISCOUNT_TOTAL);

    const voucher = await prisma.voucher.findUniqueOrThrow({ where: { code: 'VOUCH10' } });
    expect(voucher.usageRemaining).toBe(4); // decremented exactly once

    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(200000 - FINAL_TOTAL);
    const checkoutTx = walletRes.body.transactions.find((t: { type: string }) => t.type === 'CHECKOUT_CHARGE');
    expect(checkoutTx.amount).toBe(FINAL_TOTAL);
  });

  it('commits with voucher only', async () => {
    const admin = await adminToken('checkout_voucher_only_admin');
    await createVoucher(admin);

    const seller = await createSellerWithProduct('checkout_voucher_only_seller');
    const buyer = await createBuyerWithAddress('checkout_voucher_only_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 200000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR', voucherCode: 'VOUCH10' });

    expect(res.status).toBe(201);
    const expectedPpn = Math.floor(0.12 * (SUBTOTAL - VOUCHER_AMOUNT));
    const expectedFinal = SUBTOTAL - VOUCHER_AMOUNT + expectedPpn + DELIVERY_FEE;
    expect(res.body.order.discountAmount).toBe(VOUCHER_AMOUNT);
    expect(res.body.order.finalTotal).toBe(expectedFinal);

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(persisted.voucherId).not.toBeNull();
    expect(persisted.promoId).toBeNull();
  });

  it('commits with promo only', async () => {
    const admin = await adminToken('checkout_promo_only_admin');
    await createPromo(admin);

    const seller = await createSellerWithProduct('checkout_promo_only_seller');
    const buyer = await createBuyerWithAddress('checkout_promo_only_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 200000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR', promoCode: 'PROMO5K' });

    expect(res.status).toBe(201);
    const expectedPpn = Math.floor(0.12 * (SUBTOTAL - PROMO_AMOUNT));
    const expectedFinal = SUBTOTAL - PROMO_AMOUNT + expectedPpn + DELIVERY_FEE;
    expect(res.body.order.discountAmount).toBe(PROMO_AMOUNT);
    expect(res.body.order.finalTotal).toBe(expectedFinal);

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(persisted.promoId).not.toBeNull();
    expect(persisted.voucherId).toBeNull();
  });

  it('returns 409 DISCOUNT_EXPIRED for an expired voucher and rolls back entirely', async () => {
    const admin = await adminToken('checkout_expired_admin');
    const voucherId = await createVoucher(admin, { code: 'EXPVOUCH' });
    await prisma.voucher.update({ where: { id: voucherId }, data: { expiryDate: new Date(Date.now() - 1000) } });

    const seller = await createSellerWithProduct('checkout_expired_seller');
    const buyer = await createBuyerWithAddress('checkout_expired_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 200000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR', voucherCode: 'EXPVOUCH' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_EXPIRED');

    expect(await prisma.order.count()).toBe(0);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(10);
    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(200000);
    const voucher = await prisma.voucher.findUniqueOrThrow({ where: { id: voucherId } });
    expect(voucher.usageRemaining).toBe(5);
  });

  it('returns 404 DISCOUNT_NOT_FOUND for an unknown voucher code and rolls back entirely', async () => {
    const seller = await createSellerWithProduct('checkout_unknown_seller');
    const buyer = await createBuyerWithAddress('checkout_unknown_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 200000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR', voucherCode: 'NOPE1234' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISCOUNT_NOT_FOUND');

    expect(await prisma.order.count()).toBe(0);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(10);
    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(200000);
  });

  it('decrements voucher quota exactly once; a second checkout on a usageLimit=1 voucher gets 409 DISCOUNT_EXHAUSTED and rolls back', async () => {
    const admin = await adminToken('checkout_exhaust_admin');
    await createVoucher(admin, { code: 'ONLY1USE', usageLimit: 1 });

    const seller = await createSellerWithProduct('checkout_exhaust_seller');
    const buyerA = await createBuyerWithAddress('checkout_exhaust_buyer_a');
    const buyerB = await createBuyerWithAddress('checkout_exhaust_buyer_b');
    await addToCart(buyerA.token, seller.productId, 1);
    await addToCart(buyerB.token, seller.productId, 1);
    await topup(buyerA.token, 200000);
    await topup(buyerB.token, 200000);

    const first = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({ addressId: buyerA.addressId, deliveryMethod: 'REGULAR', voucherCode: 'ONLY1USE' });
    expect(first.status).toBe(201);

    const voucherAfterFirst = await prisma.voucher.findUniqueOrThrow({ where: { code: 'ONLY1USE' } });
    expect(voucherAfterFirst.usageRemaining).toBe(0);

    const second = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyerB.token}`)
      .send({ addressId: buyerB.addressId, deliveryMethod: 'REGULAR', voucherCode: 'ONLY1USE' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DISCOUNT_EXHAUSTED');

    // Buyer B's checkout rolled back entirely: no order, stock/wallet untouched.
    expect(await prisma.order.count()).toBe(1); // only buyer A's order exists
    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(9); // 10 - 1 (buyer A); buyer B's decrement rolled back
    const walletB = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyerB.token}`);
    expect(walletB.body.wallet.balance).toBe(200000);
    const voucherAfterSecond = await prisma.voucher.findUniqueOrThrow({ where: { code: 'ONLY1USE' } });
    expect(voucherAfterSecond.usageRemaining).toBe(0);
  });
});
