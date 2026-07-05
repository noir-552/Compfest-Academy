import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

// A real, minimal valid 1x1 transparent PNG (8-byte signature + IHDR/IDAT/IEND).
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function tinyPng(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, 'base64');
}

async function sellerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  return token;
}

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/seller/products/upload-image', () => {
  it('rejects requests without a token with 401', async () => {
    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .attach('image', tinyPng(), 'photo.png');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a buyer-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'BUYER' });

    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', tinyPng(), 'photo.png');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a request with no file with 400 IMAGE_REQUIRED', async () => {
    const token = await sellerToken('seller_upload_none');

    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUIRED');
  });

  it('accepts a real PNG and returns a 201 with a matching url; the file is then servable', async () => {
    const token = await sellerToken('seller_upload_png');

    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', tinyPng(), 'photo.png');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/api\/uploads\/[0-9a-f-]+\.png$/);

    const getRes = await request(app).get(res.body.url);
    expect(getRes.status).toBe(200);
    expect(getRes.headers['content-type']).toMatch(/image\/png/);
  });

  it('rejects a text file renamed .png with 400 INVALID_IMAGE (magic-byte sniff, not filename/mimetype)', async () => {
    const token = await sellerToken('seller_upload_fake');

    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('hello'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('rejects an oversized file (>2MB) with a 4xx IMAGE_TOO_LARGE', async () => {
    const token = await sellerToken('seller_upload_big');
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0);

    const res = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', oversized, 'photo.png');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error.code).toBe('IMAGE_TOO_LARGE');
  });

  it('a request to a nonexistent upload path 404s with the standard error envelope', async () => {
    const res = await request(app).get('/api/uploads/does-not-exist.png');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('an uploaded url passes the product imageUrl Zod schema end-to-end (upload -> set on product -> catalog returns it)', async () => {
    const token = await sellerToken('seller_upload_e2e');

    await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ storeName: 'Toko Foto', description: 'Jual foto' });

    const uploadRes = await request(app)
      .post('/api/seller/products/upload-image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', tinyPng(), 'photo.png');
    expect(uploadRes.status).toBe(201);
    const { url } = uploadRes.body as { url: string };

    const createRes = await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produk Foto', price: 10000, stock: 5, imageUrl: url });

    expect(createRes.status).toBe(201);
    expect(createRes.body.product.imageUrl).toBe(url);

    const catalogRes = await request(app).get(`/api/products/${createRes.body.product.id as string}`);
    expect(catalogRes.status).toBe(200);
    expect(catalogRes.body.product.imageUrl).toBe(url);
  });
});
