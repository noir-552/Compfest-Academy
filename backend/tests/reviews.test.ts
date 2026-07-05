import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateToken, hashToken } from '../src/lib/tokens';
import { resetDb, registerAndLogin } from './helpers/db';

const app = createApp();

const validReview = {
  reviewerName: 'Budi',
  rating: 5,
  comment: 'Great app!',
};

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/reviews', () => {
  it('allows a guest (no token) to post a review (201)', async () => {
    const res = await request(app).post('/api/reviews').send(validReview);

    expect(res.status).toBe(201);
    expect(res.body.review.reviewerName).toBe('Budi');
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toBe('Great app!');
    expect(res.body.review.userId).toBeUndefined();
  });

  it('links userId when a valid Bearer token is present (verified via direct DB read)', async () => {
    const { token } = await registerAndLogin(app, { roles: ['BUYER'] });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send(validReview);

    expect(res.status).toBe(201);

    const stored = await prisma.appReview.findUniqueOrThrow({ where: { id: res.body.review.id } });
    expect(stored.userId).not.toBeNull();
  });

  it('proceeds as guest (does not 401) when an invalid/garbage Bearer token is present', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validReview);

    expect(res.status).toBe(201);

    const stored = await prisma.appReview.findUniqueOrThrow({ where: { id: res.body.review.id } });
    expect(stored.userId).toBeNull();
  });

  it('succeeds as guest (201) when a Bearer token with expired session is present', async () => {
    const { username } = await registerAndLogin(app, { roles: ['BUYER'], username: 'expired_session_user' });
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

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${rawToken}`)
      .send(validReview);

    expect(res.status).toBe(201);

    const stored = await prisma.appReview.findUniqueOrThrow({ where: { id: res.body.review.id } });
    expect(stored.userId).toBeNull();
  });

  it('rejects rating 0 with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, rating: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects rating 6 with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, rating: 6 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer rating (1.5) with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, rating: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty reviewerName with 400', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, reviewerName: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a reviewerName over 50 chars with 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ ...validReview, reviewerName: 'a'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty comment with 400', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, comment: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a comment over 1000 chars with 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ ...validReview, comment: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stores and returns a <script> comment verbatim (no sanitization server-side)', async () => {
    const xssComment = '<script>alert(1)</script>';
    const res = await request(app).post('/api/reviews').send({ ...validReview, comment: xssComment });

    expect(res.status).toBe(201);
    expect(res.body.review.comment).toBe(xssComment);

    const listRes = await request(app).get('/api/reviews');
    expect(listRes.body.reviews[0].comment).toBe(xssComment);
  });
});

describe('GET /api/reviews', () => {
  it('returns reviews newest-first without leaking userId', async () => {
    await request(app).post('/api/reviews').send({ reviewerName: 'First', rating: 3, comment: 'first review' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app).post('/api/reviews').send({ reviewerName: 'Second', rating: 4, comment: 'second review' });

    const res = await request(app).get('/api/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.reviews[0].reviewerName).toBe('Second');
    expect(res.body.reviews[1].reviewerName).toBe('First');

    for (const review of res.body.reviews) {
      expect(review.userId).toBeUndefined();
      expect(Object.keys(review).sort()).toEqual(['comment', 'createdAt', 'id', 'rating', 'reviewerName'].sort());
    }
  });

  it('returns an empty list when there are no reviews', async () => {
    const res = await request(app).get('/api/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });
});
