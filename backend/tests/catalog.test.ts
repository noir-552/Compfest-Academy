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

async function createStoreAndProduct(
  username: string,
  storeOverrides: Partial<typeof validStore> = {},
  productOverrides: Partial<typeof validProduct> = {},
): Promise<{ token: string; storeId: string; productId: string }> {
  const token = await sellerToken(username);
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

describe('GET /api/products', () => {
  it('lists products for a guest (no auth) including store info', async () => {
    await createStoreAndProduct('catalog_guest');

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0]).toMatchObject({
      name: 'Kopi Susu',
      price: 15000,
      stock: 10,
      store: { storeName: 'Toko Budi' },
    });
    expect(res.body.products[0].store.id).toBeTypeOf('string');
  });

  it('filters products by case-insensitive search on name', async () => {
    await createStoreAndProduct('catalog_search_a', {}, { name: 'Kopi Susu' });
    await createStoreAndProduct('catalog_search_b', { storeName: 'Toko Lain' }, { name: 'Teh Manis' });

    const res = await request(app).get('/api/products').query({ search: 'kopi' });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Kopi Susu');
  });

  it('filters products by storeId', async () => {
    const { storeId } = await createStoreAndProduct('catalog_store_filter_a', {}, { name: 'Kopi Susu' });
    await createStoreAndProduct('catalog_store_filter_b', { storeName: 'Toko Lain' }, { name: 'Teh Manis' });

    const res = await request(app).get('/api/products').query({ storeId });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Kopi Susu');
  });

  it('excludes soft-deleted products from the public list', async () => {
    const { token, productId } = await createStoreAndProduct('catalog_deleted');

    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  it('returns an empty list when there are no products', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });
});

describe('GET /api/products/:id', () => {
  it('returns full product detail including store description for a guest', async () => {
    const { productId } = await createStoreAndProduct('catalog_detail');

    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      name: 'Kopi Susu',
      description: 'Kopi susu gula aren',
      price: 15000,
      stock: 10,
      store: { storeName: 'Toko Budi', description: 'Jual barang bagus' },
    });
  });

  it('returns 404 PRODUCT_NOT_FOUND for an unknown product id', async () => {
    const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 404 PRODUCT_NOT_FOUND for a soft-deleted product', async () => {
    const { token, productId } = await createStoreAndProduct('catalog_detail_deleted');

    await request(app).delete(`/api/seller/products/${productId}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('GET /api/stores/:id', () => {
  it('returns store info with its non-deleted products for a guest', async () => {
    const { storeId, token } = await createStoreAndProduct('catalog_store_detail', {}, { name: 'Kopi Susu' });
    await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, name: 'Teh Tarik' });
    const deletedRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProduct, name: 'Produk Hilang' });
    await request(app)
      .delete(`/api/seller/products/${deletedRes.body.product.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/stores/${storeId}`);

    expect(res.status).toBe(200);
    expect(res.body.store).toMatchObject({ storeName: 'Toko Budi', description: 'Jual barang bagus' });
    expect(res.body.store.products).toHaveLength(2);
    const names = res.body.store.products.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(['Kopi Susu', 'Teh Tarik']);
  });

  it('returns 404 STORE_NOT_FOUND for an unknown store id', async () => {
    const res = await request(app).get('/api/stores/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STORE_NOT_FOUND');
  });
});
