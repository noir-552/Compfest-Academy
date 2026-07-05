import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
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

async function sellerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  return token;
}

describe('POST /api/seller/store', () => {
  it('creates a store for the authenticated seller (201)', async () => {
    const token = await sellerToken('seller_create');

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);

    expect(res.status).toBe(201);
    expect(res.body.store.storeName).toBe('Toko Budi');
    expect(res.body.store.description).toBe('Jual barang bagus');
    expect(res.body.store.id).toBeTypeOf('string');
  });

  it('rejects requests without a token with 401', async () => {
    const res = await request(app).post('/api/seller/store').send(validStore);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'BUYER' });

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a storeName shorter than 3 chars with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_short_name');

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validStore, storeName: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a storeName longer than 50 chars with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_long_name');

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validStore, storeName: 'a'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects creating a second store for the same seller with 409 STORE_ALREADY_EXISTS', async () => {
    const token = await sellerToken('seller_dup_own');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validStore, storeName: 'Toko Budi Kedua' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STORE_ALREADY_EXISTS');
  });

  it('rejects a duplicate store name across two different sellers with 409 STORE_NAME_TAKEN', async () => {
    const tokenA = await sellerToken('seller_name_a');
    const tokenB = await sellerToken('seller_name_b');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${tokenA}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send(validStore);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STORE_NAME_TAKEN');
  });
});

describe('GET /api/seller/store', () => {
  it('returns 404 STORE_NOT_FOUND when the seller has no store yet', async () => {
    const token = await sellerToken('seller_no_store');

    const res = await request(app).get('/api/seller/store').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STORE_NOT_FOUND');
  });

  it('returns the seller own store', async () => {
    const token = await sellerToken('seller_get_own');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app).get('/api/seller/store').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.store.storeName).toBe('Toko Budi');
  });
});

describe('PUT /api/seller/store', () => {
  it('updates the seller own store', async () => {
    const token = await sellerToken('seller_update_own');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .put('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ storeName: 'Toko Budi Baru', description: 'Deskripsi baru' });

    expect(res.status).toBe(200);
    expect(res.body.store.storeName).toBe('Toko Budi Baru');
    expect(res.body.store.description).toBe('Deskripsi baru');
  });

  it('returns 404 STORE_NOT_FOUND when the seller has no store yet', async () => {
    const token = await sellerToken('seller_update_none');

    const res = await request(app)
      .put('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STORE_NOT_FOUND');
  });

  it('returns 409 STORE_NAME_TAKEN when renaming to another seller store name', async () => {
    const tokenA = await sellerToken('seller_rename_a');
    const tokenB = await sellerToken('seller_rename_b');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${tokenA}`).send(validStore);
    await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validStore, storeName: 'Toko Lain' });

    const res = await request(app)
      .put('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validStore, storeName: 'Toko Budi' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STORE_NAME_TAKEN');
  });
});

describe('POST /api/seller/products', () => {
  it('creates a product under the seller own store (201)', async () => {
    const token = await sellerToken('seller_prod_create');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Kopi Susu');
    expect(res.body.product.price).toBe(15000);
    expect(res.body.product.stock).toBe(10);
    expect(res.body.product.isDeleted).toBe(false);
  });

  it('returns 404 STORE_NOT_FOUND when the seller has no store yet', async () => {
    const token = await sellerToken('seller_prod_no_store');

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STORE_NOT_FOUND');
  });

  it('rejects a negative price with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_neg_price');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative stock with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_neg_stock');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, stock: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer price with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_float_price');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, price: 15000.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer stock with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_float_stock');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, stock: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a name over 100 chars with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_long_name');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, name: 'a'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty name with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_empty_name');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a description over 2000 chars with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_long_desc');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, description: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('persists and returns a valid imageUrl (201)', async () => {
    const token = await sellerToken('seller_prod_image_url');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: '/product-images/kopi-susu-gula-aren.jpg' });

    expect(res.status).toBe(201);
    expect(res.body.product.imageUrl).toBe('/product-images/kopi-susu-gula-aren.jpg');

    const listRes = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.products[0].imageUrl).toBe('/product-images/kopi-susu-gula-aren.jpg');
  });

  it('rejects an imageUrl with a javascript: scheme with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_image_js');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an imageUrl over 500 chars with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_image_long');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: `https://example.com/${'a'.repeat(500)}.jpg` });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a protocol-relative imageUrl with 400 VALIDATION_ERROR', async () => {
    const token = await sellerToken('seller_prod_image_proto_rel');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: '//evil.com/x.jpg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('omits imageUrl (null) when not provided', async () => {
    const token = await sellerToken('seller_prod_image_omit');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);

    expect(res.status).toBe(201);
    expect(res.body.product.imageUrl).toBeNull();
  });
});

describe('GET /api/seller/products', () => {
  it('lists only the seller own, non-deleted products', async () => {
    const tokenA = await sellerToken('seller_list_a');
    const tokenB = await sellerToken('seller_list_b');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${tokenA}`).send(validStore);
    await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validStore, storeName: 'Toko B' });

    await request(app).post('/api/seller/products').set('Authorization', `Bearer ${tokenA}`).send(validProduct);
    await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validProduct, name: 'Produk B' });

    const res = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Kopi Susu');
  });

  it('returns an empty list when the seller has a store but no products', async () => {
    const token = await sellerToken('seller_list_empty');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  it('excludes soft-deleted products from the list', async () => {
    const token = await sellerToken('seller_list_deleted');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });
});

describe('PUT /api/seller/products/:id', () => {
  it('updates the seller own product', async () => {
    const token = await sellerToken('seller_prod_update_own');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    const res = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, price: 20000 });

    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(20000);
  });

  it('sets and then clears imageUrl via null', async () => {
    const token = await sellerToken('seller_prod_update_image');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: '/product-images/kopi-susu-gula-aren.jpg' });
    const productId = createRes.body.product.id as string;

    const setRes = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: '/product-images/roti-bakar-coklat.jpg' });
    expect(setRes.status).toBe(200);
    expect(setRes.body.product.imageUrl).toBe('/product-images/roti-bakar-coklat.jpg');

    const clearRes = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.product.imageUrl).toBeNull();
  });

  it('preserves the existing imageUrl on a partial update that omits the field', async () => {
    const token = await sellerToken('seller_prod_update_image_omit');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, imageUrl: '/product-images/kopi-susu-gula-aren.jpg' });
    const productId = createRes.body.product.id as string;

    // Note: `validProduct` itself has no imageUrl key, so this PUT body omits
    // the field entirely (as opposed to sending an explicit `imageUrl: null`).
    const res = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, price: 20000 });

    expect(res.status).toBe(200);
    expect(res.body.product.imageUrl).toBe('/product-images/kopi-susu-gula-aren.jpg');

    const listRes = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.products[0].imageUrl).toBe('/product-images/kopi-susu-gula-aren.jpg');
  });

  it('returns 404 PRODUCT_NOT_FOUND when the product does not exist', async () => {
    const token = await sellerToken('seller_prod_update_missing');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .put('/api/seller/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it("returns 403 NOT_OWNER when updating another seller's product", async () => {
    const tokenA = await sellerToken('seller_prod_owner_a');
    const tokenB = await sellerToken('seller_prod_owner_b');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${tokenA}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validStore, storeName: 'Toko B Lain' });

    const res = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validProduct, price: 99999 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_OWNER');
  });
});

describe('DELETE /api/seller/products/:id', () => {
  it('soft-deletes the seller own product', async () => {
    const token = await sellerToken('seller_prod_delete_own');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    const res = await request(app)
      .delete(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/seller/products').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.products).toEqual([]);
  });

  it('returns 404 PRODUCT_NOT_FOUND when the product does not exist', async () => {
    const token = await sellerToken('seller_prod_delete_missing');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const res = await request(app)
      .delete('/api/seller/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it("returns 403 NOT_OWNER when deleting another seller's product", async () => {
    const tokenA = await sellerToken('seller_prod_delete_owner_a');
    const tokenB = await sellerToken('seller_prod_delete_owner_b');

    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${tokenA}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validStore, storeName: 'Toko B Lain 2' });

    const res = await request(app)
      .delete(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_OWNER');
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'BUYER' });

    const res = await request(app)
      .delete('/api/seller/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('returns 404 PRODUCT_NOT_FOUND when updating a soft-deleted product', async () => {
    const token = await sellerToken('seller_prod_delete_then_update');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    // Delete the product
    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${token}`);

    // Try to update the deleted product
    const res = await request(app)
      .put(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, price: 20000 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 404 PRODUCT_NOT_FOUND when deleting a soft-deleted product again', async () => {
    const token = await sellerToken('seller_prod_delete_twice');
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);
    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProduct);
    const productId = createRes.body.product.id as string;

    // Delete the product
    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${token}`);

    // Try to delete the already-deleted product
    const res = await request(app)
      .delete(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
