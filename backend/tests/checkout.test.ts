import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

const validStore = {
  storeName: 'Toko Budi',
  description: 'Jual barang bagus',
};

const validProduct = {
  name: 'Kopi Susu',
  description: 'Kopi susu gula aren',
  price: 15000,
  stock: 10,
};

const validAddress = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  phone: '081234567890',
  fullAddress: 'Jl. Merdeka No. 1, Jakarta',
};

beforeEach(async () => {
  await resetDb();
});

interface SellerSetup {
  token: string;
  storeId: string;
  productId: string;
}

async function createSellerWithProduct(
  username: string,
  storeOverrides: Partial<typeof validStore> = {},
  productOverrides: Partial<typeof validProduct> = {},
): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validStore, ...storeOverrides });
  const storeId = storeRes.body.store.id as string;

  const productRes = await request(app)
    .post('/api/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validProduct, ...productOverrides });
  const productId = productRes.body.product.id as string;

  return { token, storeId, productId };
}

interface BuyerSetup {
  token: string;
  addressId: string;
}

async function createBuyerWithAddress(
  username: string,
  addressOverrides: Partial<typeof validAddress> = {},
): Promise<BuyerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  const addressRes = await request(app)
    .post('/api/buyer/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validAddress, ...addressOverrides });
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

// price 15000 * qty 2 = 30000 subtotal; REGULAR delivery fee 10000; ppn floor(0.12*30000)=3600
const EXPECTED_SUBTOTAL = 30000;
const EXPECTED_DELIVERY_FEE = 10000;
const EXPECTED_PPN = 3600;
const EXPECTED_FINAL_TOTAL = 43600;

describe('POST /api/buyer/checkout/preview', () => {
  it('returns totals matching the money lib exactly, without writing anything', async () => {
    const seller = await createSellerWithProduct('preview_seller');
    const buyer = await createBuyerWithAddress('preview_buyer');
    await addToCart(buyer.token, seller.productId, 2);

    const res = await request(app)
      .post('/api/buyer/checkout/preview')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(seller.storeId);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId: seller.productId,
      productNameSnapshot: 'Kopi Susu',
      priceSnapshot: 15000,
      quantity: 2,
      lineTotal: EXPECTED_SUBTOTAL,
    });
    expect(res.body.totals).toEqual({
      subtotal: EXPECTED_SUBTOTAL,
      discountAmount: 0,
      deliveryFee: EXPECTED_DELIVERY_FEE,
      ppnAmount: EXPECTED_PPN,
      finalTotal: EXPECTED_FINAL_TOTAL,
    });

    // Nothing was committed.
    expect(await prisma.order.count()).toBe(0);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(10);
    const cartRes = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${buyer.token}`);
    expect(cartRes.body.cart.items).toHaveLength(1);
  });

  it('returns 400 CART_EMPTY when the cart has no live items', async () => {
    const buyer = await createBuyerWithAddress('preview_empty_buyer');

    const res = await request(app)
      .post('/api/buyer/checkout/preview')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('returns 404 ADDRESS_NOT_FOUND for an address belonging to another buyer', async () => {
    const seller = await createSellerWithProduct('preview_addr_seller');
    const buyer = await createBuyerWithAddress('preview_addr_buyer');
    const otherBuyer = await createBuyerWithAddress('preview_addr_other');
    await addToCart(buyer.token, seller.productId, 1);

    const res = await request(app)
      .post('/api/buyer/checkout/preview')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: otherBuyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app)
      .post('/api/buyer/checkout/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: 'whatever', deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('POST /api/buyer/checkout', () => {
  it('commits a full order: stock decremented, wallet debited, history + tx row written, cart cleared', async () => {
    const seller = await createSellerWithProduct('checkout_seller');
    const buyer = await createBuyerWithAddress('checkout_buyer');
    await addToCart(buyer.token, seller.productId, 2);
    await topup(buyer.token, 100000);

    const before = Date.now();
    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });
    const after = Date.now();

    expect(res.status).toBe(201);
    const order = res.body.order;
    expect(order.storeId).toBe(seller.storeId);
    expect(order.addressId).toBe(buyer.addressId);
    expect(order.deliveryMethod).toBe('REGULAR');
    expect(order.subtotal).toBe(EXPECTED_SUBTOTAL);
    expect(order.discountAmount).toBe(0);
    expect(order.deliveryFee).toBe(EXPECTED_DELIVERY_FEE);
    expect(order.ppnAmount).toBe(EXPECTED_PPN);
    expect(order.finalTotal).toBe(EXPECTED_FINAL_TOTAL);
    expect(order.currentStatus).toBe('SEDANG_DIKEMAS');
    expect(order.recipientNameSnapshot).toBe(validAddress.recipientName);
    expect(order.phoneSnapshot).toBe(validAddress.phone);
    expect(order.fullAddressSnapshot).toBe(validAddress.fullAddress);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productId: seller.productId,
      productNameSnapshot: 'Kopi Susu',
      priceSnapshot: 15000,
      quantity: 2,
    });
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0]).toMatchObject({ status: 'SEDANG_DIKEMAS', changedByRole: 'BUYER' });

    // slaDeadline ~= now + 4 days (REGULAR)
    const slaMs = new Date(order.slaDeadline).getTime();
    const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
    expect(slaMs).toBeGreaterThanOrEqual(before + fourDaysMs - 1000);
    expect(slaMs).toBeLessThanOrEqual(after + fourDaysMs + 1000);

    // Stock decremented.
    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(8);

    // Wallet debited exactly finalTotal.
    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(100000 - EXPECTED_FINAL_TOTAL);
    const checkoutTx = walletRes.body.transactions.find((t: { type: string }) => t.type === 'CHECKOUT_CHARGE');
    expect(checkoutTx).toBeDefined();
    expect(checkoutTx.amount).toBe(EXPECTED_FINAL_TOTAL);
    expect(checkoutTx.orderId).toBe(order.id);

    // Cart emptied and storeId reset.
    const cartRes = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${buyer.token}`);
    expect(cartRes.body.cart.items).toEqual([]);
    expect(cartRes.body.cart.storeId).toBeNull();
  });

  it('rolls back entirely on insufficient balance: 409 and stock unchanged', async () => {
    const seller = await createSellerWithProduct('insuff_balance_seller');
    const buyer = await createBuyerWithAddress('insuff_balance_buyer');
    await addToCart(buyer.token, seller.productId, 2);
    // No topup: wallet balance is 0.

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(10);
    expect(await prisma.order.count()).toBe(0);

    const cartRes = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${buyer.token}`);
    expect(cartRes.body.cart.items).toHaveLength(1);
  });

  it('rolls back entirely on insufficient stock: 409 and wallet unchanged', async () => {
    const seller = await createSellerWithProduct('insuff_stock_seller');
    const buyer = await createBuyerWithAddress('insuff_stock_buyer');
    await addToCart(buyer.token, seller.productId, 5);
    await topup(buyer.token, 1_000_000);

    // Seller sells out most of the stock elsewhere (simulated via a direct update),
    // leaving less than the buyer's cart quantity.
    await request(app)
      .put(`/api/seller/products/${seller.productId}`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ ...validProduct, stock: 2 });

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('Kopi Susu');

    const walletRes = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${buyer.token}`);
    expect(walletRes.body.wallet.balance).toBe(1_000_000);
    expect(await prisma.order.count()).toBe(0);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: seller.productId } });
    expect(product.stock).toBe(2);
  });

  it('returns 400 CART_EMPTY when the cart has no live items', async () => {
    const buyer = await createBuyerWithAddress('checkout_empty_buyer');

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('returns 404 ADDRESS_NOT_FOUND for an address belonging to another buyer', async () => {
    const seller = await createSellerWithProduct('checkout_addr_seller');
    const buyer = await createBuyerWithAddress('checkout_addr_buyer');
    const otherBuyer = await createBuyerWithAddress('checkout_addr_other');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: otherBuyer.addressId, deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: 'whatever', deliveryMethod: 'REGULAR' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('GET /api/buyer/orders', () => {
  it('lists own orders newest first with summary fields', async () => {
    const seller = await createSellerWithProduct('history_seller');
    const buyer = await createBuyerWithAddress('history_buyer');
    await topup(buyer.token, 1_000_000);

    await addToCart(buyer.token, seller.productId, 1);
    const first = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    await addToCart(buyer.token, seller.productId, 1);
    const second = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'INSTANT' });

    const res = await request(app).get('/api/buyer/orders').set('Authorization', `Bearer ${buyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.orders[0].id).toBe(second.body.order.id);
    expect(res.body.orders[1].id).toBe(first.body.order.id);
    expect(res.body.orders[0].finalTotal).toBeGreaterThan(0);
  });

  it('returns full detail incl. items, statusHistory, and snapshots for own order', async () => {
    const seller = await createSellerWithProduct('detail_seller');
    const buyer = await createBuyerWithAddress('detail_buyer');
    await addToCart(buyer.token, seller.productId, 2);
    await topup(buyer.token, 1_000_000);

    const checkoutRes = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });
    const orderId = checkoutRes.body.order.id as string;

    const res = await request(app)
      .get(`/api/buyer/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.recipientNameSnapshot).toBe(validAddress.recipientName);
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0].productNameSnapshot).toBe('Kopi Susu');
    expect(res.body.order.statusHistory).toHaveLength(1);
    expect(res.body.order.statusHistory[0].status).toBe('SEDANG_DIKEMAS');
  });

  it('returns 404 ORDER_NOT_FOUND when reading another buyer\'s order (no leak)', async () => {
    const seller = await createSellerWithProduct('leak_seller');
    const buyerA = await createBuyerWithAddress('leak_buyer_a');
    const buyerB = await createBuyerWithAddress('leak_buyer_b');
    await addToCart(buyerA.token, seller.productId, 1);
    await topup(buyerA.token, 1_000_000);

    const checkoutRes = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({ addressId: buyerA.addressId, deliveryMethod: 'REGULAR' });
    const orderId = checkoutRes.body.order.id as string;

    const res = await request(app)
      .get(`/api/buyer/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyerB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('GET /api/seller/orders', () => {
  it('shows an incoming order to the owning seller, incl. buyer username and items', async () => {
    const seller = await createSellerWithProduct('incoming_seller');
    const buyer = await createBuyerWithAddress('incoming_buyer');
    await addToCart(buyer.token, seller.productId, 2);
    await topup(buyer.token, 1_000_000);

    const checkoutRes = await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });
    const orderId = checkoutRes.body.order.id as string;

    const res = await request(app).get('/api/seller/orders').set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].id).toBe(orderId);
    expect(res.body.orders[0].buyerUsername).toBe('incoming_buyer');
    expect(res.body.orders[0].items).toHaveLength(1);
    expect(res.body.orders[0].currentStatus).toBe('SEDANG_DIKEMAS');
  });

  it('does not show another seller\'s incoming order', async () => {
    const seller = await createSellerWithProduct('other_seller_a', { storeName: 'Toko Alpha' });
    const otherSeller = await createSellerWithProduct('other_seller_b', { storeName: 'Toko Beta' });
    const buyer = await createBuyerWithAddress('other_seller_buyer');
    await addToCart(buyer.token, seller.productId, 1);
    await topup(buyer.token, 1_000_000);

    await request(app)
      .post('/api/buyer/checkout')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ addressId: buyer.addressId, deliveryMethod: 'REGULAR' });

    const res = await request(app).get('/api/seller/orders').set('Authorization', `Bearer ${otherSeller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });
});
