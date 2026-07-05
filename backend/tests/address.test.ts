import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

const validAddress = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  phone: '081234567890',
  fullAddress: 'Jl. Merdeka No. 1, Jakarta',
};

beforeEach(async () => {
  await resetDb();
});

async function buyerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  return token;
}

describe('POST /api/buyer/addresses', () => {
  it('creates an address for the authenticated buyer (201)', async () => {
    const token = await buyerToken('addr_create');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);

    expect(res.status).toBe(201);
    expect(res.body.address.label).toBe('Rumah');
    expect(res.body.address.recipientName).toBe('Budi Santoso');
    expect(res.body.address.phone).toBe('081234567890');
    expect(res.body.address.fullAddress).toBe('Jl. Merdeka No. 1, Jakarta');
    expect(res.body.address.isDefault).toBe(false);
    expect(res.body.address.id).toBeTypeOf('string');
  });

  it('rejects requests without a token with 401', async () => {
    const res = await request(app).post('/api/buyer/addresses').send(validAddress);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });

  it('rejects a phone number shorter than 8 digits with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_short_phone');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a phone number longer than 15 digits with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_long_phone');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, phone: '1'.repeat(16) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a phone number containing non-digit characters with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_alpha_phone');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, phone: '0812abc4567' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty fullAddress with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_empty_full');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, fullAddress: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a fullAddress over 500 chars with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_long_full');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, fullAddress: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sets isDefault true when requested and clears no prior default on the first address', async () => {
    const token = await buyerToken('addr_first_default');

    const res = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, isDefault: true });

    expect(res.status).toBe(201);
    expect(res.body.address.isDefault).toBe(true);
  });

  it('clears the previous default when a new address is created with isDefault true', async () => {
    const token = await buyerToken('addr_switch_default');

    const firstRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, isDefault: true });
    const firstId = firstRes.body.address.id as string;

    await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, label: 'Kantor', isDefault: true });

    const listRes = await request(app).get('/api/buyer/addresses').set('Authorization', `Bearer ${token}`);
    const first = listRes.body.addresses.find((a: { id: string }) => a.id === firstId);

    expect(first.isDefault).toBe(false);
    const defaults = listRes.body.addresses.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe('Kantor');
  });
});

describe('GET /api/buyer/addresses', () => {
  it('lists only the authenticated buyer own addresses', async () => {
    const tokenA = await buyerToken('addr_list_a');
    const tokenB = await buyerToken('addr_list_b');

    await request(app).post('/api/buyer/addresses').set('Authorization', `Bearer ${tokenA}`).send(validAddress);
    await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validAddress, label: 'Kantor B' });

    const res = await request(app).get('/api/buyer/addresses').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].label).toBe('Rumah');
  });

  it('returns an empty list when the buyer has no addresses yet', async () => {
    const token = await buyerToken('addr_list_empty');

    const res = await request(app).get('/api/buyer/addresses').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.addresses).toEqual([]);
  });
});

describe('PUT /api/buyer/addresses/:id', () => {
  it('partially updates the label only', async () => {
    const token = await buyerToken('addr_update_partial');
    const createRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    const addressId = createRes.body.address.id as string;

    const res = await request(app)
      .put(`/api/buyer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Rumah Baru' });

    expect(res.status).toBe(200);
    expect(res.body.address.label).toBe('Rumah Baru');
    expect(res.body.address.recipientName).toBe('Budi Santoso');
  });

  it('returns 404 ADDRESS_NOT_FOUND when the address does not exist', async () => {
    const token = await buyerToken('addr_update_missing');

    const res = await request(app)
      .put('/api/buyer/addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it("returns 404 ADDRESS_NOT_FOUND when updating another buyer's address", async () => {
    const tokenA = await buyerToken('addr_update_owner_a');
    const tokenB = await buyerToken('addr_update_owner_b');

    const createRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validAddress);
    const addressId = createRes.body.address.id as string;

    const res = await request(app)
      .put(`/api/buyer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ label: 'Hacked' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('rejects an invalid phone on partial update with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('addr_update_bad_phone');
    const createRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    const addressId = createRes.body.address.id as string;

    const res = await request(app)
      .put(`/api/buyer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('clears previous default when setting isDefault true via update', async () => {
    const token = await buyerToken('addr_update_default');
    const firstRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, isDefault: true });
    const firstId = firstRes.body.address.id as string;

    const secondRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, label: 'Kantor' });
    const secondId = secondRes.body.address.id as string;

    const updateRes = await request(app)
      .put(`/api/buyer/addresses/${secondId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isDefault: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.address.isDefault).toBe(true);

    const listRes = await request(app).get('/api/buyer/addresses').set('Authorization', `Bearer ${token}`);
    const first = listRes.body.addresses.find((a: { id: string }) => a.id === firstId);
    expect(first.isDefault).toBe(false);
  });
});

describe('DELETE /api/buyer/addresses/:id', () => {
  it('deletes the buyer own address', async () => {
    const token = await buyerToken('addr_delete_own');
    const createRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    const addressId = createRes.body.address.id as string;

    const res = await request(app).delete(`/api/buyer/addresses/${addressId}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/buyer/addresses').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.addresses).toEqual([]);
  });

  it('returns 404 ADDRESS_NOT_FOUND when the address does not exist', async () => {
    const token = await buyerToken('addr_delete_missing');

    const res = await request(app)
      .delete('/api/buyer/addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it("returns 404 ADDRESS_NOT_FOUND when deleting another buyer's address", async () => {
    const tokenA = await buyerToken('addr_delete_owner_a');
    const tokenB = await buyerToken('addr_delete_owner_b');

    const createRes = await request(app)
      .post('/api/buyer/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validAddress);
    const addressId = createRes.body.address.id as string;

    const res = await request(app)
      .delete(`/api/buyer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app)
      .delete('/api/buyer/addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});
