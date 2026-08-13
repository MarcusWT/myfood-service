import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './test-app.js';

describe('OpenAPI documentation', () => {
  describe('GET /api/docs.json', () => {
    it('returns a valid OpenAPI 3.0 document describing all routes', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/api/docs.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toMatch(/^3\.0\./);
      expect(res.body.info).toMatchObject({ title: 'myfood-service' });

      const paths = Object.keys(res.body.paths);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/health',
          '/food-items',
          '/food-items/{id}',
          '/alerts/expiry',
          '/recipes/suggestions',
          '/shopping/summary',
        ]),
      );
    });
  });

  describe('GET /api/docs', () => {
    it('serves the Swagger UI page', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/api/docs/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });
});
