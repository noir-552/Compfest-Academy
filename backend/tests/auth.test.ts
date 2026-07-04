import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateToken, hashToken } from '../src/lib/tokens';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

const validRegisterBody = {
  username: 'budi_belanja',
  email: 'budi@example.com',
  phone: '081234567890',
  password: 'password123',
  roles: ['BUYER'],
};

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/auth/register', () => {
  it('registers a new user (201) without leaking the password', async () => {
    const res = await request(app).post('/api/auth/register').send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('budi_belanja');
    expect(res.body.user.email).toBe('budi@example.com');
    expect(res.body.roles).toEqual(['BUYER']);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('password');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate username with 409 USERNAME_TAKEN', async () => {
    await request(app).post('/api/auth/register').send(validRegisterBody);
    const res = await request(app).post('/api/auth/register').send(validRegisterBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid phone with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, phone: 'abc123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a too-short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registering with role ADMIN with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, username: 'wannabe_admin', roles: ['ADMIN'] });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects a wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send(validRegisterBody);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'budi_belanja', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('sets activeRole automatically when the user has exactly one role', async () => {
    await request(app).post('/api/auth/register').send(validRegisterBody);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'budi_belanja', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBe('BUYER');
    expect(res.body.token).toBeTypeOf('string');
  });

  it('leaves activeRole null when the user has multiple roles', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, username: 'rangga_multi', roles: ['BUYER', 'SELLER'] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'rangga_multi', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBeNull();
    expect(res.body.roles.sort()).toEqual(['BUYER', 'SELLER']);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests without a token with 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the profile and role list with a valid token', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['BUYER']);
    expect(res.body.activeRole).toBe('BUYER');
    expect(res.body.user.username).toBeTypeOf('string');
  });

  it('rejects an expired session with 401', async () => {
    const { username } = await registerAndLogin(app, { roles: ['BUYER'], username: 'expired_user' });
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

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${rawToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/active-role', () => {
  it('rejects a role the user does not own with 403 ROLE_NOT_OWNED', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });

    const res = await request(app)
      .post('/api/auth/active-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SELLER' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_NOT_OWNED');
  });

  it('accepts an owned role with 200 and /me reflects the change', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER', 'SELLER'] });

    const res = await request(app)
      .post('/api/auth/active-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SELLER' });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBe('SELLER');

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.body.activeRole).toBe('SELLER');
  });
});

describe('POST /api/auth/logout', () => {
  it('invalidates the token so subsequent requests get 401', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });

    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);
  });
});
