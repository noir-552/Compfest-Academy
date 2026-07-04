import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { resetDb, registerAndLogin, registerAndLoginAdmin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

function futureIso(daysAhead = 7): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

const validVoucherPayload = {
  code: 'DISKON10',
  discountType: 'PERCENT',
  discountValue: 10,
  usageLimit: 5,
};

const validPromoPayload = {
  code: 'PROMO5K',
  discountType: 'FIXED',
  discountValue: 5000,
};

async function adminToken(username: string): Promise<string> {
  const { token } = await registerAndLoginAdmin(app, { username });
  return token;
}

async function buyerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  return token;
}

describe('POST /api/admin/vouchers', () => {
  it('creates a voucher with usageRemaining initialized to usageLimit (201)', async () => {
    const token = await adminToken('admin_voucher_create');
    const expiryDate = futureIso();

    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate });

    expect(res.status).toBe(201);
    expect(res.body.voucher).toMatchObject({
      code: 'DISKON10',
      discountType: 'PERCENT',
      discountValue: 10,
      usageLimit: 5,
      usageRemaining: 5,
    });
    expect(res.body.voucher.id).toBeTypeOf('string');
    expect(res.body.voucher.createdByAdminId).toBeTypeOf('string');
  });

  it('rejects a non-admin (active buyer) with 403 WRONG_ROLE', async () => {
    const token = await buyerToken('voucher_buyer_forbidden');
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate: futureIso() });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a lowercase code with 400 VALIDATION_ERROR', async () => {
    const token = await adminToken('voucher_lowercase');
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, code: 'diskon10', expiryDate: futureIso() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects PERCENT discountValue of 101 with 400 VALIDATION_ERROR', async () => {
    const token = await adminToken('voucher_percent_over');
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, discountValue: 101, expiryDate: futureIso() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a past expiryDate with 400 VALIDATION_ERROR', async () => {
    const token = await adminToken('voucher_past_expiry');
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate: pastIso() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate code with 409 DISCOUNT_CODE_TAKEN', async () => {
    const token = await adminToken('voucher_dup');
    const expiryDate = futureIso();
    await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate });

    const res = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_CODE_TAKEN');
  });
});

describe('GET /api/admin/vouchers', () => {
  it('lists created vouchers', async () => {
    const token = await adminToken('voucher_list');
    await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate: futureIso() });

    const res = await request(app).get('/api/admin/vouchers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.vouchers).toHaveLength(1);
    expect(res.body.vouchers[0].code).toBe('DISKON10');
  });
});

describe('GET /api/admin/vouchers/:id', () => {
  it('returns voucher detail', async () => {
    const token = await adminToken('voucher_detail');
    const createRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validVoucherPayload, expiryDate: futureIso() });
    const id = createRes.body.voucher.id as string;

    const res = await request(app).get(`/api/admin/vouchers/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.voucher.id).toBe(id);
    expect(res.body.voucher.code).toBe('DISKON10');
  });
});

describe('POST /api/admin/promos', () => {
  it('creates a promo without usage fields (201)', async () => {
    const token = await adminToken('promo_create');
    const res = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate: futureIso() });

    expect(res.status).toBe(201);
    expect(res.body.promo).toMatchObject({
      code: 'PROMO5K',
      discountType: 'FIXED',
      discountValue: 5000,
    });
    expect(res.body.promo.usageLimit).toBeUndefined();
    expect(res.body.promo.usageRemaining).toBeUndefined();
  });

  it('rejects a non-admin (active buyer) with 403 WRONG_ROLE', async () => {
    const token = await buyerToken('promo_buyer_forbidden');
    const res = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate: futureIso() });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a lowercase code with 400 VALIDATION_ERROR', async () => {
    const token = await adminToken('promo_lowercase');
    const res = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, code: 'promo5k', expiryDate: futureIso() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a past expiryDate with 400 VALIDATION_ERROR', async () => {
    const token = await adminToken('promo_past_expiry');
    const res = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate: pastIso() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate code with 409 DISCOUNT_CODE_TAKEN', async () => {
    const token = await adminToken('promo_dup');
    const expiryDate = futureIso();
    await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate });

    const res = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_CODE_TAKEN');
  });
});

describe('GET /api/admin/promos + /api/admin/promos/:id', () => {
  it('lists and shows promo detail', async () => {
    const token = await adminToken('promo_list_detail');
    const createRes = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPromoPayload, expiryDate: futureIso() });
    const id = createRes.body.promo.id as string;

    const listRes = await request(app).get('/api/admin/promos').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.promos).toHaveLength(1);

    const detailRes = await request(app).get(`/api/admin/promos/${id}`).set('Authorization', `Bearer ${token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.promo.id).toBe(id);
  });
});

describe('POST /api/discounts/validate', () => {
  it('returns the computed amount for a valid voucher (PERCENT floors)', async () => {
    const admin = await adminToken('validate_voucher_admin');
    await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'VCR10PCT', discountType: 'PERCENT', discountValue: 10, usageLimit: 5, expiryDate: futureIso() });

    const buyer = await buyerToken('validate_voucher_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'VCR10PCT', subtotal: 33333 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'VOUCHER',
      code: 'VCR10PCT',
      discountType: 'PERCENT',
      discountValue: 10,
      amount: 3333, // floor(10 * 33333 / 100) = floor(3333.3)
    });
  });

  it('returns the computed amount for a valid promo (FIXED capped at subtotal)', async () => {
    const admin = await adminToken('validate_promo_admin');
    await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'PROMOFX', discountType: 'FIXED', discountValue: 100000, expiryDate: futureIso() });

    const buyer = await buyerToken('validate_promo_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'PROMOFX', subtotal: 20000 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'PROMO',
      code: 'PROMOFX',
      discountType: 'FIXED',
      discountValue: 100000,
      amount: 20000, // FIXED discount capped at subtotal
    });
  });

  it('returns 409 DISCOUNT_EXPIRED for an expired voucher', async () => {
    const admin = await adminToken('validate_expired_admin');
    const createRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'EXPIRED1', discountType: 'FIXED', discountValue: 1000, usageLimit: 5, expiryDate: futureIso() });
    const id = createRes.body.voucher.id as string;
    await prisma.voucher.update({ where: { id }, data: { expiryDate: new Date(Date.now() - 1000) } });

    const buyer = await buyerToken('validate_expired_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'EXPIRED1', subtotal: 10000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_EXPIRED');
  });

  it('returns 409 DISCOUNT_EXPIRED for an expired promo', async () => {
    const admin = await adminToken('validate_expired_promo_admin');
    const createRes = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'EXPPROMO', discountType: 'FIXED', discountValue: 1000, expiryDate: futureIso() });
    const id = createRes.body.promo.id as string;
    await prisma.promo.update({ where: { id }, data: { expiryDate: new Date(Date.now() - 1000) } });

    const buyer = await buyerToken('validate_expired_promo_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'EXPPROMO', subtotal: 10000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_EXPIRED');
  });

  it('returns 409 DISCOUNT_EXHAUSTED when voucher usageRemaining is 0', async () => {
    const admin = await adminToken('validate_exhausted_admin');
    const createRes = await request(app)
      .post('/api/admin/vouchers')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: 'EXHAUST1', discountType: 'FIXED', discountValue: 1000, usageLimit: 1, expiryDate: futureIso() });
    const id = createRes.body.voucher.id as string;
    await prisma.voucher.update({ where: { id }, data: { usageRemaining: 0 } });

    const buyer = await buyerToken('validate_exhausted_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'EXHAUST1', subtotal: 10000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCOUNT_EXHAUSTED');
  });

  it('returns 404 DISCOUNT_NOT_FOUND for an unknown code', async () => {
    const buyer = await buyerToken('validate_unknown_buyer');
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${buyer}`)
      .send({ code: 'NOPE1234', subtotal: 10000 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISCOUNT_NOT_FOUND');
  });

  it('rejects a non-buyer active role with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['SELLER'], activeRole: 'SELLER' });
    const res = await request(app)
      .post('/api/discounts/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ANY1234', subtotal: 1000 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});
