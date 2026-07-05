import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';

describe('API documentation', () => {
  it('GET /api/docs serves the Swagger UI (200, HTML)', async () => {
    const res = await request(createApp()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('GET /api/openapi.json serves the parsed OpenAPI spec', async () => {
    const res = await request(createApp()).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('SEAPEDIA API');
    expect(res.body.paths).toHaveProperty('/auth/login');
    expect(res.body.paths).toHaveProperty('/buyer/checkout');
    expect(res.body.paths).toHaveProperty('/admin/simulate-next-day');
  });
});
