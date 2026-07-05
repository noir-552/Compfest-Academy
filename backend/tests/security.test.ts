import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateToken, hashToken } from '../src/lib/tokens';
import { _resetLoginRateLimiterForTests } from '../src/middleware/rate-limit';
import { resetDb, registerAndLogin, registerAndLoginAdmin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  _resetLoginRateLimiterForTests();
});

// ---------------------------------------------------------------------------
// Shared fixtures / helpers
// ---------------------------------------------------------------------------

const validStore = { storeName: 'Toko Aman', description: 'Toko untuk uji keamanan' };
const validProduct = { name: 'Kopi Susu', description: 'Kopi susu gula aren', price: 15000, stock: 10 };
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

async function createSellerWithProduct(username: string, storeName?: string, productName?: string): Promise<SellerSetup> {
  const { token } = await registerAndLogin(app, { roles: ['SELLER'], username });
  const storeRes = await request(app)
    .post('/api/seller/store')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validStore, storeName: storeName ?? `${validStore.storeName} ${username}` });
  const storeId = storeRes.body.store.id as string;

  const productRes = await request(app)
    .post('/api/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validProduct, name: productName ?? validProduct.name });
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

// ---------------------------------------------------------------------------
// SQL injection resistance
// ---------------------------------------------------------------------------

const SQLI_PAYLOADS = ["' OR '1'='1' --", '"; DROP TABLE "User";--', "admin'--"];

describe('SQL injection resistance', () => {
  it.each(SQLI_PAYLOADS)('login with SQLi payload as username never authenticates (401, not 200): %s', async (payload) => {
    const res = await request(app).post('/api/auth/login').send({ username: payload, password: 'irrelevant123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('User table survives SQLi login attempts: a normal register+login still works afterward', async () => {
    for (const payload of SQLI_PAYLOADS) {
      await request(app).post('/api/auth/login').send({ username: payload, password: 'irrelevant123' });
    }

    const registerRes = await request(app).post('/api/auth/register').send({
      username: 'sqli_survivor',
      email: 'sqli_survivor@example.com',
      phone: '081234567890',
      password: 'password123',
      roles: ['BUYER'],
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sqli_survivor', password: 'password123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTypeOf('string');
  });

  it.each(SQLI_PAYLOADS)('product search with SQLi payload returns a normal filtered result, never everything: %s', async (payload) => {
    const seller = await createSellerWithProduct('sqli_search_seller');
    await request(app)
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ ...validProduct, name: 'Teh Manis' });

    const baseline = await request(app).get('/api/products');
    expect(baseline.body.products).toHaveLength(2);

    const res = await request(app).get('/api/products').query({ search: payload });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    // The payload text doesn't match either real product name, so it must
    // filter down to nothing — never fall through to "return everything".
    expect(res.body.products.length).toBe(0);
  });

  it.each(SQLI_PAYLOADS)('review reviewerName/comment SQLi payload is stored as inert text, no crash: %s', async (payload) => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ reviewerName: payload.slice(0, 50), rating: 5, comment: payload });

    expect(res.status).toBe(201);
    expect(res.body.review.comment).toBe(payload);

    const listRes = await request(app).get('/api/reviews');
    expect(listRes.status).toBe(200);
    expect(listRes.body.reviews.some((r: { comment: string }) => r.comment === payload)).toBe(true);
  });

  it.each(SQLI_PAYLOADS)('discount validate SQLi payload code returns 404 DISCOUNT_NOT_FOUND, no crash: %s', async (payload) => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });

    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: payload, subtotal: 10000 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISCOUNT_NOT_FOUND');
  });

  it('Voucher table survives SQLi validate attempts: a real voucher still validates afterward', async () => {
    const { token: buyerToken } = await registerAndLogin(app, { roles: ['BUYER'], username: 'sqli_voucher_buyer' });

    for (const payload of SQLI_PAYLOADS) {
      await request(app)
        .post('/api/discounts/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: payload, subtotal: 10000 });
    }

    const { token: adminToken } = await registerAndLoginAdmin(app, { username: 'sqli_voucher_admin' });
    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const voucherRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SURVIVE10', discountType: 'PERCENT', discountValue: 10, usageLimit: 5, expiryDate });
    expect(voucherRes.status).toBe(201);

    const validateRes = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ code: 'SURVIVE10', subtotal: 10000 });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.kind).toBe('VOUCHER');
  });
});

// ---------------------------------------------------------------------------
// XSS-safe storage (backend stores + returns text safely; escaping is React's job)
// ---------------------------------------------------------------------------

describe('XSS-safe review storage', () => {
  it('stores <script> and <img onerror> payloads verbatim, returned as JSON strings with application/json content-type', async () => {
    const scriptPayload = '<script>alert(1)</script>';
    const imgPayload = '<img src=x onerror=alert(1)>';

    const res1 = await request(app).post('/api/reviews').send({ reviewerName: 'Scripter', rating: 5, comment: scriptPayload });
    expect(res1.status).toBe(201);
    expect(res1.body.review.comment).toBe(scriptPayload);

    const res2 = await request(app).post('/api/reviews').send({ reviewerName: 'Imgur', rating: 5, comment: imgPayload });
    expect(res2.status).toBe(201);
    expect(res2.body.review.comment).toBe(imgPayload);

    const listRes = await request(app).get('/api/reviews');
    expect(listRes.status).toBe(200);
    expect(listRes.headers['content-type']).toMatch(/application\/json/);

    const comments = listRes.body.reviews.map((r: { comment: string }) => r.comment);
    expect(comments).toContain(scriptPayload);
    expect(comments).toContain(imgPayload);
  });

  it('rejects a comment over the 1000-char limit with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ reviewerName: 'Overflow', rating: 5, comment: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a grossly oversized 10,000-char comment with 400, not a crash', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ reviewerName: 'Flood', rating: 5, comment: 'a'.repeat(10_000) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Session / logout invalidation
// ---------------------------------------------------------------------------

describe('logout truly invalidates the session', () => {
  it('buyer token 401s on /api/buyer/wallet after logout', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });
    const before = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const after = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('seller token 401s on /api/seller/store after logout', async () => {
    const { token } = await registerAndLogin(app, { roles: ['SELLER'] });
    await request(app).post('/api/seller/store').set('Authorization', `Bearer ${token}`).send(validStore);

    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const after = await request(app).get('/api/seller/store').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('driver token 401s on /api/driver/jobs/mine after logout', async () => {
    const token = await driverToken('logout_driver');
    const before = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const after = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('admin token 401s on /api/admin/overview after logout', async () => {
    const { token } = await registerAndLoginAdmin(app, { username: 'logout_admin' });
    const before = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const after = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('an expired (but never logged out) session 401s on a private endpoint', async () => {
    const { username } = await registerAndLogin(app, { roles: ['BUYER'], username: 'expired_security_user' });
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });

    const rawToken = generateToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        activeRole: 'BUYER',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${rawToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

// ---------------------------------------------------------------------------
// RBAC / active-role enforcement
// ---------------------------------------------------------------------------

describe('server-side active-role enforcement', () => {
  it('a BUYER-only user gets 403 WRONG_ROLE on a seller endpoint', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });
    const res = await request(app).get('/api/seller/store').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('a BUYER-only user gets 403 WRONG_ROLE on a driver endpoint', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });
    const res = await request(app).get('/api/driver/jobs/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('a BUYER-only user gets 403 on an admin endpoint', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('a multi-role user (owns SELLER, active BUYER) still gets 403 WRONG_ROLE on a seller endpoint', async () => {
    const { token } = await registerAndLogin(app, {
      roles: ['BUYER', 'SELLER'],
      activeRole: 'BUYER',
    });

    const res = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('owning a role is not enough without setting it active: switching to SELLER then unlocks the seller endpoint', async () => {
    const { token } = await registerAndLogin(app, {
      roles: ['BUYER', 'SELLER'],
      activeRole: 'BUYER',
    });

    const blocked = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);
    expect(blocked.status).toBe(403);

    const switchRes = await request(app)
      .post('/api/auth/active-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SELLER' });
    expect(switchRes.status).toBe(200);

    const allowed = await request(app)
      .post('/api/seller/store')
      .set('Authorization', `Bearer ${token}`)
      .send(validStore);
    expect(allowed.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Cross-user resource access
// ---------------------------------------------------------------------------

describe('no cross-user resource access', () => {
  it("seller B updating seller A's product returns 403 NOT_OWNER", async () => {
    const sellerA = await createSellerWithProduct('xuser_seller_a');
    const sellerB = await createSellerWithProduct('xuser_seller_b');

    const res = await request(app)
      .put(`/api/seller/products/${sellerA.productId}`)
      .set('Authorization', `Bearer ${sellerB.token}`)
      .send({ ...validProduct, price: 999999 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_OWNER');
  });

  it("seller B deleting seller A's product returns 403 NOT_OWNER", async () => {
    const sellerA = await createSellerWithProduct('xuser_seller_c');
    const sellerB = await createSellerWithProduct('xuser_seller_d');

    const res = await request(app)
      .delete(`/api/seller/products/${sellerA.productId}`)
      .set('Authorization', `Bearer ${sellerB.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_OWNER');
  });

  it("buyer B GETting buyer A's order returns 404 ORDER_NOT_FOUND", async () => {
    const seller = await createSellerWithProduct('xuser_order_seller');
    const buyerA = await createBuyerWithAddress('xuser_order_buyer_a');
    const buyerB = await createBuyerWithAddress('xuser_order_buyer_b');

    const orderId = await checkoutOneOrder(seller, buyerA);

    const res = await request(app)
      .get(`/api/buyer/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyerB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it("driver B completing driver A's job returns 403 NOT_YOUR_JOB", async () => {
    const seller = await createSellerWithProduct('xuser_job_seller');
    const buyer = await createBuyerWithAddress('xuser_job_buyer');
    const orderId = await checkoutOneOrder(seller, buyer);
    await processOrder(seller, orderId);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { orderId } });

    const driverA = await driverToken('xuser_job_driver_a');
    const driverB = await driverToken('xuser_job_driver_b');

    await request(app).post(`/api/driver/jobs/${job.id}/take`).set('Authorization', `Bearer ${driverA}`);

    const res = await request(app)
      .post(`/api/driver/jobs/${job.id}/complete`)
      .set('Authorization', `Bearer ${driverB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_YOUR_JOB');

    const persistedJob = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(persistedJob.status).toBe('TAKEN');
    expect(persistedJob.driverUserId).not.toBeNull();
  });

  it("buyer B updating buyer A's address returns 404 ADDRESS_NOT_FOUND", async () => {
    const buyerA = await createBuyerWithAddress('xuser_addr_a');
    const buyerB = await createBuyerWithAddress('xuser_addr_b');

    const res = await request(app)
      .put(`/api/buyer/addresses/${buyerA.addressId}`)
      .set('Authorization', `Bearer ${buyerB.token}`)
      .send({ label: 'Hacked' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it("buyer B deleting buyer A's address returns 404 ADDRESS_NOT_FOUND", async () => {
    const buyerA = await createBuyerWithAddress('xuser_addr_c');
    const buyerB = await createBuyerWithAddress('xuser_addr_d');

    const res = await request(app)
      .delete(`/api/buyer/addresses/${buyerA.addressId}`)
      .set('Authorization', `Bearer ${buyerB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Hardening: body-size cap
// ---------------------------------------------------------------------------

describe('request body size cap', () => {
  it('rejects a request body over the 100kb express.json limit with 413, not a hang or 500', async () => {
    const hugeComment = 'a'.repeat(200_000);

    const res = await request(app)
      .post('/api/reviews')
      .send({ reviewerName: 'TooBig', rating: 5, comment: hugeComment });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

// ---------------------------------------------------------------------------
// Hardening: login rate limiting
// ---------------------------------------------------------------------------

describe('login rate limiting', () => {
  it('blocks further attempts from the same IP after exceeding the failed-login budget (429 TOO_MANY_ATTEMPTS)', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'ratelimited_user',
      email: 'ratelimited_user@example.com',
      phone: '081234567890',
      password: 'password123',
      roles: ['BUYER'],
    });

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ratelimited_user', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ratelimited_user', password: 'wrongpassword' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    // Blocking is per-IP, not per-username: even the correct password is
    // rejected until the window resets.
    const correctButBlocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ratelimited_user', password: 'password123' });
    expect(correctButBlocked.status).toBe(429);
  });

  it('does not penalize successful logins: many legitimate register+login flows never trip the limiter', async () => {
    for (let i = 0; i < 15; i += 1) {
      const { token } = await registerAndLogin(app, { roles: ['BUYER'], username: `ratelimit_ok_${i}` });
      expect(token).toBeTypeOf('string');
    }
  });
});
