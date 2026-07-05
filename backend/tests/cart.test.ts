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

beforeEach(async () => {
  await resetDb();
});

async function buyerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  return token;
}

async function createStoreAndProduct(
  username: string,
  storeOverrides: Partial<typeof validStore> = {},
  productOverrides: Partial<typeof validProduct> = {},
): Promise<{ token: string; storeId: string; productId: string }> {
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

describe('GET /api/buyer/cart', () => {
  it('auto-creates an empty cart on first access', async () => {
    const token = await buyerToken('cart_new');

    const res = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart.storeId).toBeNull();
    expect(res.body.cart.store).toBeNull();
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.subtotal).toBe(0);
  });

  it('rejects requests without a token with 401', async () => {
    const res = await request(app).get('/api/buyer/cart');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('prunes items whose product became soft-deleted, resetting storeId when cart empties', async () => {
    const { storeId, productId, token: sellerToken } = await createStoreAndProduct('cart_prune_seller');
    const token = await buyerToken('cart_prune_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${sellerToken}`);

    const res = await request(app).get('/api/buyer/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.storeId).toBeNull();
    expect(res.body.cart.subtotal).toBe(0);
  });
});

describe('POST /api/buyer/cart/items', () => {
  it('adds the first item and sets the cart storeId', async () => {
    const { storeId, productId } = await createStoreAndProduct('cart_add_seller');
    const token = await buyerToken('cart_add_buyer');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.cart.storeId).toBe(storeId);
    expect(res.body.cart.store).toMatchObject({ id: storeId, storeName: 'Toko Budi' });
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0]).toMatchObject({
      product: { id: productId, name: 'Kopi Susu', price: 15000, stock: 10, imageUrl: null },
      quantity: 2,
      lineTotal: 30000,
    });
    expect(res.body.cart.subtotal).toBe(30000);
  });

  it('increments quantity when adding an already-in-cart product (upsert)', async () => {
    const { productId } = await createStoreAndProduct('cart_upsert_seller');
    const token = await buyerToken('cart_upsert_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(5);
    expect(res.body.cart.subtotal).toBe(75000);
  });

  it('rejects a second add that would exceed stock after incrementing with 400 INSUFFICIENT_STOCK', async () => {
    const { productId } = await createStoreAndProduct('cart_upsert_over_seller', {}, { stock: 5 });
    const token = await buyerToken('cart_upsert_over_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 3 });

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('Kopi Susu');
  });

  it('rejects adding items from a different store with 409 CART_STORE_CONFLICT', async () => {
    const { productId: productA } = await createStoreAndProduct('cart_conflict_seller_a', { storeName: 'Toko A' });
    const { productId: productB } = await createStoreAndProduct(
      'cart_conflict_seller_b',
      { storeName: 'Toko B' },
      { name: 'Teh Tarik' },
    );
    const token = await buyerToken('cart_conflict_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productA, quantity: 1 });

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productB, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CART_STORE_CONFLICT');
    expect(res.body.error.message.toLowerCase()).toContain('clear');
  });

  it('allows adding from a new store after clearing the cart (conflict -> clear -> add flow)', async () => {
    const { productId: productA } = await createStoreAndProduct('cart_flow_seller_a', { storeName: 'Toko A' });
    const { productId: productB, storeId: storeB } = await createStoreAndProduct(
      'cart_flow_seller_b',
      { storeName: 'Toko B' },
      { name: 'Teh Tarik' },
    );
    const token = await buyerToken('cart_flow_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productA, quantity: 1 });

    const conflictRes = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productB, quantity: 1 });
    expect(conflictRes.status).toBe(409);

    await request(app).delete('/api/buyer/cart').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productB, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.cart.storeId).toBe(storeB);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].product.id).toBe(productB);
  });

  it('allows adding from a new store when the only cart item was soft-deleted without an intervening GET (stale storeId)', async () => {
    const { productId: productA } = await createStoreAndProduct('cart_stale_seller_a', { storeName: 'Toko A' });
    const { productId: productB, storeId: storeB } = await createStoreAndProduct(
      'cart_stale_seller_b',
      { storeName: 'Toko B' },
      { name: 'Teh Tarik' },
    );
    const token = await buyerToken('cart_stale_buyer');

    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productA, quantity: 1 });

    // Soft-delete the only cart item's product directly, bypassing any GET /cart
    // that would normally trigger the prune-on-read self-healing logic.
    await prisma.product.update({ where: { id: productA }, data: { isDeleted: true } });

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: productB, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.cart.storeId).toBe(storeB);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].product.id).toBe(productB);
  });

  it('returns 404 PRODUCT_NOT_FOUND for an unknown product', async () => {
    const token = await buyerToken('cart_unknown_product');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 404 PRODUCT_NOT_FOUND for a soft-deleted product', async () => {
    const { productId, token: sellerToken } = await createStoreAndProduct('cart_deleted_product_seller');
    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${sellerToken}`);
    const token = await buyerToken('cart_deleted_product_buyer');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects quantity greater than stock with 400 INSUFFICIENT_STOCK including product name', async () => {
    const { productId } = await createStoreAndProduct('cart_over_stock_seller', {}, { stock: 3 });
    const token = await buyerToken('cart_over_stock_buyer');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('Kopi Susu');
  });

  it('rejects a quantity of 0 with 400 VALIDATION_ERROR', async () => {
    const { productId } = await createStoreAndProduct('cart_zero_qty_seller');
    const token = await buyerToken('cart_zero_qty_buyer');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer quantity with 400 VALIDATION_ERROR', async () => {
    const { productId } = await createStoreAndProduct('cart_float_qty_seller');
    const token = await buyerToken('cart_float_qty_buyer');

    const res = await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/buyer/cart/items/:productId', () => {
  it('updates the quantity of an item already in the cart', async () => {
    const { productId } = await createStoreAndProduct('cart_update_seller');
    const token = await buyerToken('cart_update_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .put(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].quantity).toBe(5);
    expect(res.body.cart.subtotal).toBe(75000);
  });

  it('rejects updating an item not in the cart with 404 CART_ITEM_NOT_FOUND', async () => {
    const { productId } = await createStoreAndProduct('cart_update_missing_seller');
    const token = await buyerToken('cart_update_missing_buyer');

    const res = await request(app)
      .put(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CART_ITEM_NOT_FOUND');
  });

  it('rejects a quantity exceeding stock with 400 INSUFFICIENT_STOCK', async () => {
    const { productId } = await createStoreAndProduct('cart_update_over_seller', {}, { stock: 5 });
    const token = await buyerToken('cart_update_over_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .put(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 6 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects a quantity of 0 with 400 VALIDATION_ERROR', async () => {
    const { productId } = await createStoreAndProduct('cart_update_zero_seller');
    const token = await buyerToken('cart_update_zero_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .put(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/buyer/cart/items/:productId', () => {
  it('removes an item from the cart', async () => {
    const { productId } = await createStoreAndProduct('cart_remove_seller', {}, { stock: 10 });
    const token = await buyerToken('cart_remove_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .delete(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });

  it('resets storeId to null when the last item is removed', async () => {
    const { productId } = await createStoreAndProduct('cart_remove_last_seller');
    const token = await buyerToken('cart_remove_last_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .delete(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart.storeId).toBeNull();
    expect(res.body.cart.store).toBeNull();
  });

  it('returns 404 CART_ITEM_NOT_FOUND when removing an item not in the cart', async () => {
    const { productId } = await createStoreAndProduct('cart_remove_missing_seller');
    const token = await buyerToken('cart_remove_missing_buyer');

    const res = await request(app)
      .delete(`/api/buyer/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CART_ITEM_NOT_FOUND');
  });
});

describe('DELETE /api/buyer/cart', () => {
  it('clears all items and resets storeId to null', async () => {
    const { productId } = await createStoreAndProduct('cart_clear_seller');
    const token = await buyerToken('cart_clear_buyer');
    await request(app)
      .post('/api/buyer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app).delete('/api/buyer/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.storeId).toBeNull();
    expect(res.body.cart.subtotal).toBe(0);
  });
});
