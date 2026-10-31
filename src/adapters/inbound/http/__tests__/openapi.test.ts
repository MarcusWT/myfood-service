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
          '/health/ready',
          '/food-items',
          '/food-items/{id}',
          '/alerts/expiry',
          '/recipes/suggestions',
          '/shopping/summary',
        ]),
      );
    });
  });

  describe('food item request schemas', () => {
    it('documents bestBefore format and nullable notes/minimumQuantity on PATCH', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/docs.json');
      const resolve = (s: { $ref?: string }) =>
        s.$ref ? res.body.components.schemas[s.$ref.split('/').pop()!] : s;

      const create = resolve(
        res.body.paths['/food-items'].post.requestBody.content['application/json'].schema,
      );
      expect(create.properties.bestBefore).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(create.properties.bestBefore.description).toMatch(/UTC midnight/);

      const patch = resolve(
        res.body.paths['/food-items/{id}'].patch.requestBody.content['application/json'].schema,
      );
      expect(patch.properties.bestBefore).toMatchObject({ type: 'string', format: 'date-time' });
      expect(patch.properties.notes.nullable).toBe(true);
      expect(patch.properties.minimumQuantity.nullable).toBe(true);
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
