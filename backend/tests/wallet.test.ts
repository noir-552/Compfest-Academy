import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

async function buyerToken(username: string): Promise<string> {
  const { token } = await registerAndLogin(app, { roles: ['BUYER'], username });
  return token;
}

describe('GET /api/buyer/wallet', () => {
  it('auto-creates a wallet with zero balance and empty history on first access', async () => {
    const token = await buyerToken('wallet_new');

    const res = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(0);
    expect(res.body.transactions).toEqual([]);
  });

  it('rejects requests without a token with 401', async () => {
    const res = await request(app).get('/api/buyer/wallet');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});

describe('POST /api/buyer/wallet/topup', () => {
  it('increases the balance and records a TOPUP transaction', async () => {
    const token = await buyerToken('wallet_topup');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(50000);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].type).toBe('TOPUP');
    expect(res.body.transactions[0].amount).toBe(50000);
  });

  it('accumulates balance across multiple topups and lists history newest first', async () => {
    const token = await buyerToken('wallet_multi_topup');

    await request(app).post('/api/buyer/wallet/topup').set('Authorization', `Bearer ${token}`).send({ amount: 10000 });
    await request(app).post('/api/buyer/wallet/topup').set('Authorization', `Bearer ${token}`).send({ amount: 25000 });

    const res = await request(app).get('/api/buyer/wallet').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(35000);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].amount).toBe(25000);
    expect(res.body.transactions[1].amount).toBe(10000);
  });

  it('rejects an amount of 0 with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('wallet_zero');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative amount with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('wallet_negative');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -1000 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer amount with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('wallet_float');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an amount over 100,000,000 with 400 VALIDATION_ERROR', async () => {
    const token = await buyerToken('wallet_over_max');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100_000_001 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts the maximum allowed amount of 100,000,000', async () => {
    const token = await buyerToken('wallet_max');

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100_000_000 });

    expect(res.status).toBe(200);
    expect(res.body.wallet.balance).toBe(100_000_000);
  });

  it('rejects a seller-active-role user with 403 WRONG_ROLE', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'], activeRole: 'SELLER' });

    const res = await request(app)
      .post('/api/buyer/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10000 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ROLE');
  });
});
